import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { load } from 'cheerio';
import { inScope } from '../src/scope.mjs';

const catalog = JSON.parse(await fs.readFile('public/data/catalog.json', 'utf8'));
const records = catalog.records.filter(inScope);
const root = 'data/documents';
const origin = 'https://subastas.boe.es';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function readJson(path) {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
}
async function request(url) {
  if (new URL(url).origin !== origin) throw Error('Enlace fuera del BOE');
  await delay(650);
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { 'User-Agent': 'SubastasBOE/0.1 (+https://github.com/jorpago2/subastas-boe)' } });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  if (new URL(response.url).origin !== origin) throw Error('Redirección fuera del BOE');
  return response;
}
function linksFrom(html, id, pageUrl) {
  const $ = load(html);
  if (!$('#contenido > h2').text().includes(id)) throw Error(`Ficha inesperada: ${id}`);
  const documents = [], lots = [];
  $('#contenido a[href]').each((_, element) => {
    const a = $(element), url = new URL(a.attr('href'), pageUrl);
    if (url.origin !== origin || url.searchParams.get('idSub') !== id) return;
    if (/\/(verDocumento|verCertificadoCierre)\.php$/.test(url.pathname) && !a.find('img').length) documents.push({ title: a.text().replace(/\s+/g, ' ').trim(), url: url.href });
    if (url.pathname.endsWith('/detalleSubasta.php') && url.searchParams.get('ver') === '3' && url.searchParams.get('idLote') && /^Lote\s+\d+/i.test(a.text().trim())) lots.push(url.href);
  });
  return { documents, lots: [...new Set(lots)] };
}
async function download(document, dir) {
  const url = new URL(document.url);
  const code = url.searchParams.get('idDoc');
  if (code && !/^\d+-[a-z0-9]+$/i.test(code)) throw Error('Identificador de documento inesperado');
  const file = code ? `doc-${code}.pdf` : 'certificado-cierre.pdf';
  const path = `${dir}/${file}`;
  try {
    const bytes = await fs.readFile(path);
    if (bytes.subarray(0,5).toString() === '%PDF-') return { ...document, file, status: 'downloaded', bytes: bytes.length, sha256: hash(bytes) };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const response = await request(document.url);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type');
  if (bytes.subarray(0,5).toString() !== '%PDF-') return { ...document, status: contentType?.includes('text/html') ? 'not-accessible' : 'not-pdf', contentType };
  await fs.writeFile(path+'.tmp', bytes);
  await fs.rename(path+'.tmp', path);
  return { ...document, file, status: 'downloaded', bytes: bytes.length, sha256: hash(bytes) };
}
async function processRecord(row) {
  if (!/^SUB-[A-Z]+-\d{4}-[A-Z0-9]+$/.test(row.id)) throw Error('ID de subasta inesperado');
  const dir = `${root}/${row.id}`, path = `${dir}/public-downloads.json`;
  await fs.mkdir(dir, { recursive: true });
  const previous = await readJson(path);
  if (previous?.scanComplete) return previous;
  const result = { id: row.id, checkedAt: new Date().toISOString(), access: 'public', portalStatus: row.documents?.status, scanComplete: false, items: [], pagesVisited: [] };
  const documents = new Map((row.documents?.items || []).map(d => [d.url, d]));
  try {
    if (row.documents?.status !== 'unavailable') {
      const queue = [row.url+'&ver=3'];
      const seen = new Set();
      while (queue.length) {
        const url = queue.shift(); if (seen.has(url)) continue; seen.add(url);
        const page = linksFrom(await (await request(url)).text(), row.id, url);
        result.pagesVisited.push(url);
        for (const doc of page.documents) documents.set(doc.url, doc);
        for (const lot of page.lots) if (!seen.has(lot)) queue.push(lot);
      }
    }
    for (const document of documents.values()) {
      try { result.items.push(await download(document, dir)); }
      catch (error) { result.items.push({ ...document, status: 'error', error: error.message }); }
    }
    result.scanComplete = !result.items.some(d => d.status === 'error');
  } catch (error) { result.error = error.message; }
  await fs.writeFile(path+'.tmp', JSON.stringify(result, null, 2));
  await fs.rename(path+'.tmp', path);
  return result;
}
let index = 0, completed = 0, pdfs = 0, errors = 0;
async function worker() {
  while (index < records.length) {
    const row = records[index++];
    const result = await processRecord(row);
    completed++; pdfs += result.items.filter(d => d.status === 'downloaded').length;
    if (!result.scanComplete) errors++;
    if (completed % 25 === 0 || completed === records.length) console.log(JSON.stringify({ completed, total: records.length, pdfs, errors }));
  }
}
await Promise.all([worker(), worker(), worker()]);
if (errors) process.exitCode = 1;

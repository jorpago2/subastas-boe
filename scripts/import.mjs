import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { origin, parseListing, parseDetail, parseGoods, parseOutcome, parseDocuments } from './boe.mjs';
import { scope, inScope } from '../src/scope.mjs';

const { values } = parseArgs({ options: { current: { type: 'boolean' }, sample: { type: 'boolean' }, 'export-only': { type: 'boolean' }, 'results-only': { type: 'boolean' }, 'documents-only': { type: 'boolean' }, from: { type: 'string' }, to: { type: 'string' }, limit: { type: 'string', default: '50' }, state: { type: 'string', default: '' } } });
const limit = Number(values.limit);
if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit debe ser un entero positivo');
if (!['', 'EJ', 'PU', 'PC', 'FS', 'CA', 'SU'].includes(values.state)) throw new Error('Estado BOE no válido');
if (!values.current && !values.sample && !values['documents-only'] && !values['results-only'] && !values['export-only'] && (!values.from || !values.to)) throw new Error('Usa --current, --sample, --documents-only, --results-only, --export-only o --from AAAA-MM-DD --to AAAA-MM-DD');
for (const date of [values.from, values.to].filter(Boolean)) if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || date < '2016-01-01') throw new Error('Fecha inválida o anterior a 2016');
if (values.from > values.to) throw new Error('El inicio debe preceder al final');
await mkdir('data', { recursive: true });
await mkdir('public/data', { recursive: true });
const db = new DatabaseSync('data/subastas.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS auctions (id TEXT PRIMARY KEY, record TEXT NOT NULL); CREATE TABLE IF NOT EXISTS scans (id INTEGER PRIMARY KEY, record TEXT NOT NULL);');
const upsert = db.prepare('INSERT INTO auctions VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET record=excluded.record');
const find = db.prepare('SELECT record FROM auctions WHERE id=?');
// La copia de consulta permite reconstruir SQLite al clonar el repositorio.
if (!db.prepare('SELECT COUNT(*) AS n FROM auctions').get().n) {
  try {
    const seed = JSON.parse(await readFile('public/data/catalog.json', 'utf8'));
    for (const row of seed.records) upsert.run(row.id, JSON.stringify(row));
    for (const scan of seed.scans) db.prepare('INSERT INTO scans(record) VALUES (?)').run(JSON.stringify(scan));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function request(url, options = {}) {
  if (new URL(url).origin !== new URL(origin).origin) throw new Error('Enlace fuera del portal BOE');
  await delay(650);
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'SubastasBOE/0.1 (+https://github.com/jorpago2/subastas-boe)', ...options.headers } });
  if (!response.ok) throw new Error(`BOE respondió HTTP ${response.status}; importación detenida, progreso conservado`);
  return response.text();
}
async function scan(query, category, code, cap) {
  const form = new URLSearchParams({ accion: 'Buscar', page_hits: '50', 'campo[3]': 'BIEN.TIPO', 'dato[3]': code, 'campo[2]': 'SUBASTA.ESTADO.CODIGO', 'dato[2]': query.state || '', 'campo[18]': 'SUBASTA.FECHA_INICIO', 'dato[18][0]': query.from || '', 'dato[18][1]': query.to || '', 'sort_field[0]': 'SUBASTA.FECHA_FIN', 'sort_order[0]': 'asc' });
  form.set('campo[8]', 'BIEN.COD_PROVINCIA');
  form.set('dato[8]', scope.provinceCode);
  let page = parseListing(await request(`${origin}subastas_ava.php`, { method: 'POST', body: form }));
  const total = page.total, seen = new Set();
  while (true) {
    for (const row of page.rows) {
      if (seen.has(row.id)) throw new Error('Paginación repetida; consulta interrumpida');
      seen.add(row.id);
      // Hasta tres lecturas independientes por ficha; la siguiente espera a que terminen.
      const [html, goodsHtml, outcomeHtml] = await Promise.all([
        request(row.url),
        request(`${row.url}&ver=3`),
        row.status === 'Pasada' ? request(`${row.url}&ver=5`) : null,
      ]);
      const detail = { ...parseDetail(html, row.id), documents: parseDocuments(html, row.id) };
      const goods = parseGoods(goodsHtml);
      const previous = find.get(row.id);
      const categories = previous ? JSON.parse(previous.record).categories : [];
      const record = { ...row, ...detail, ...goods, scope: scope.id, categories: [...new Set([...categories, category])], checkedAt: new Date().toISOString() };
      // La consulta pública no debe borrar los resultados contrastados con sesión.
      if (previous && JSON.parse(previous.record).authenticatedOutcome) record.authenticatedOutcome = JSON.parse(previous.record).authenticatedOutcome;
      if (previous && JSON.parse(previous.record).authenticatedDocuments) record.authenticatedDocuments = JSON.parse(previous.record).authenticatedDocuments;
      if (previous && JSON.parse(previous.record).documentAnalysis) record.documentAnalysis = JSON.parse(previous.record).documentAnalysis;
      if (previous && JSON.parse(previous.record).certifiedOutcome) record.certifiedOutcome = JSON.parse(previous.record).certifiedOutcome;
      if (outcomeHtml !== null) record.outcome = parseOutcome(outcomeHtml, row.id);
      upsert.run(row.id, JSON.stringify(record));
      console.log(`${row.id} · ${category} · ${row.status}`);
      if (seen.size >= cap) break;
    }
    if (seen.size >= cap || !page.next) break;
    page = parseListing(await request(page.next));
  }
  const report = { ...query, scope: scope.id, category, province: scope.province, total, imported: seen.size, complete: total !== null && seen.size === total, checkedAt: new Date().toISOString() };
  db.prepare('INSERT INTO scans(record) VALUES (?)').run(JSON.stringify(report));
}
async function exportData() {
  const records = db.prepare('SELECT record FROM auctions ORDER BY id').all().map(row => JSON.parse(row.record)).filter(inScope);
  const history = db.prepare('SELECT record FROM scans ORDER BY id').all().map(row => JSON.parse(row.record)).filter(inScope);
  const scans = [...new Map(history.map(scan => [JSON.stringify([scan.from,scan.to,scan.state,scan.category]),scan])).values()];
  // ponytail: un archivo basta para la muestra; dividir por año antes del histórico completo.
  const result = { generatedAt: new Date().toISOString(), scope, coverage: 'partial', scans, records };
  await writeFile('public/data/catalog.json.tmp', JSON.stringify(result));
  await rename('public/data/catalog.json.tmp', 'public/data/catalog.json');
  console.log(`Catálogo exportado: ${records.length} subastas. Cobertura parcial.`);
}
try {
  if (values['documents-only']) {
    for (const entry of db.prepare('SELECT record FROM auctions ORDER BY id').all()) {
      const row = JSON.parse(entry.record);
      if (!inScope(row)) continue;
      row.documents = parseDocuments(await request(row.url), row.id);
      upsert.run(row.id, JSON.stringify(row));
      console.log(`${row.id} · documentación ${row.documents.status}`);
    }
  } else if (values['results-only']) {
    const records = db.prepare('SELECT record FROM auctions ORDER BY id').all().map(row => JSON.parse(row.record));
    for (const row of records.filter(row => inScope(row) && row.status === 'Pasada')) {
      row.outcome = parseOutcome(await request(`${row.url}&ver=5`), row.id);
      upsert.run(row.id, JSON.stringify(row));
      console.log(`${row.id} · ${row.outcome.status}`);
    }
  } else if (!values['export-only']) {
  const queries = values.current ? [{ state: 'EJ' }, { state: 'PU' }] : values.sample ? [{ from: '2016-01-01', to: '2016-01-31', state: '' }, { state: 'EJ' }, { state: 'PU' }] : [{ from: values.from, to: values.to, state: values.state }];
  for (const query of queries) await scan(query, scope.category, 'I', values.sample ? 4 : limit);
  }
} finally {
  await exportData();
  db.close();
}

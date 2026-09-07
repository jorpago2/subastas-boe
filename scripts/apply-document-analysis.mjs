import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { excludedIds } from '../src/scope.mjs';

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const manifest = read('data/documents/valencia-pdf-manifest.json');
const catalog = read('public/data/catalog.json');
const annexes = read('data/analysis/annexes.json');
const active = read('data/analysis/active-annexes.json');
const historical = fs.existsSync('data/analysis/historical-reviews.json') ? read('data/analysis/historical-reviews.json') : { records:[] };
const closures = read('data/analysis/closures.json');
const files = new Map();
for (const file of manifest.files) {
  const key = `${file.id}:${file.sha256}`;
  if (!files.has(key)) files.set(key, []);
  files.get(key).push(file);
}
function validateSource(id, source) {
  const candidates = files.get(`${id}:${source.sha256}`);
  assert.ok(candidates?.length, `Fuente no verificada: ${id}`);
  const url = new URL(source.url);
  assert.equal(url.origin, 'https://subastas.boe.es');
  assert.equal(url.searchParams.get('idSub'), id);
  assert.equal(source.pages, candidates[0].pages);
}
function validateAnalysis(id, analysis) {
  assert.ok(analysis.points.length && analysis.sources.length, `Análisis vacío: ${id}`);
  for (const source of analysis.sources) validateSource(id, source);
  for (const point of analysis.points) {
    assert.ok(point.title && point.text && point.evidence, `Sin evidencia: ${id}`);
    for (const ref of point.references || []) {
      const source = analysis.sources.find(s => s.sha256 === ref.sha256);
      assert.ok(source && Number.isInteger(ref.page) && ref.page > 0 && ref.page <= source.pages, `Página incorrecta: ${id}`);
    }
  }
}
const automatic = new Map(annexes.records.map(r => [r.id, r.documentAnalysis]));
const reviewed = new Map([...active.records,...historical.records].map(r => [r.id, r.documentAnalysis]));
const outcomes = new Map(closures.records.map(r => [r.id, r]));
assert.equal(active.records.length, catalog.records.filter(r => ['Activa','Próxima'].includes(r.status)).length);
assert.equal(reviewed.size, active.records.length + historical.records.length, 'Revisiones duplicadas');
const ids = new Set(catalog.records.map(r=>r.id));
for (const id of [...reviewed.keys(),...automatic.keys(),...outcomes.keys()]) assert.ok(ids.has(id) || excludedIds.has(id), `Fuera del catálogo: ${id}`);
assert.equal(closures.summary.needsReview, 0);
const backup = 'data/analysis/subastas.before-document-analysis.sqlite';
if (!fs.existsSync(backup)) fs.copyFileSync('data/subastas.sqlite', backup);
const db = new DatabaseSync('data/subastas.sqlite');
const get = db.prepare('SELECT record FROM auctions WHERE id=?');
const update = db.prepare('UPDATE auctions SET record=? WHERE id=?');
const prepared = [];
for (const entry of catalog.records) {
  const row = JSON.parse(get.get(entry.id).record);
  const proposed = reviewed.get(row.id) || automatic.get(row.id);
  // Preserve earlier individual reviews when this run only offers automatic extraction.
  if (proposed && (reviewed.has(row.id) || !row.documentAnalysis || ['partial','automatic-extraction','certificate-only'].includes(row.documentAnalysis.status))) row.documentAnalysis = proposed;
  const closure = outcomes.get(row.id);
  if (closure) {
    assert.equal(closure.analysisStatus, 'complete');
    assert.ok(files.has(`${row.id}:${closure.sha256}`));
    assert.ok(['Con pujas','Sin pujas','Cancelada','Por lotes'].includes(closure.status));
    for (const bid of [closure, ...closure.lotBids]) {
      if (bid.status === 'Con pujas') assert.ok(Number.isSafeInteger(bid.highestBid) && bid.highestBid >= 0);
    }
    row.certifiedOutcome = { status:closure.status,highestBid:closure.highestBid,lotBids:closure.lotBids,
      source:closure.source,checkedAt:closure.checkedAt,access:'public-certificate',sha256:closure.sha256 };
    if (!row.documentAnalysis) {
      const file = files.get(`${row.id}:${closure.sha256}`)[0];
      row.documentAnalysis = { reviewedAt:closure.checkedAt,status:'certificate-only',
        method:closures.method,sources:[{title:'Certificado de cierre',url:closure.source,sha256:closure.sha256,pages:file.pages}],
        points:[{title:'Cómo terminó',text:closure.summary,evidence:`Certificado de cierre, páginas ${[...new Set(closure.evidence.flatMap(e=>e.pages))].join(', ')}.`}],
        limitations:row.documents?.status === 'unavailable'
          ? 'El certificado acredita las pujas, no la adjudicación definitiva. El BOE ha retirado los demás anexos.'
          : 'El certificado acredita las pujas, no la adjudicación definitiva ni la situación del inmueble.',portalSource:row.url };
    }
  }
  assert.ok(row.documentAnalysis, `Ficha sin análisis: ${row.id}`);
  validateAnalysis(row.id,row.documentAnalysis);
  prepared.push(row);
}
assert.equal(prepared.length,catalog.records.length);
db.exec('BEGIN');
try {
  for (const row of prepared) update.run(JSON.stringify(row),row.id);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  db.exec('COMMIT');
} catch (error) { db.exec('ROLLBACK'); throw error; }
db.close();
console.log(JSON.stringify({ updated:prepared.length,certificates:outcomes.size,individualAnnexReviews:reviewed.size,backup }));

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inScope, scope, anonymizePublicText, sanitizePublicRecord } from '../src/scope.mjs';
import { deriveFacts } from '../src/facts.mjs';

test('excluye el vehículo documentado y conserva inmuebles y consultas del BOE', () => {
  assert.equal(inScope({ scope: scope.id, id: 'SUB-JV-2026-264894' }), false);
  assert.equal(inScope({ scope: scope.id, id: 'SUB-JA-2025-243864' }), true);
  assert.equal(inScope({ scope: scope.id }), true);
  assert.equal(inScope({ scope: 'otra-provincia' }), false);
});

test('anonimiza nombres personales en la copia pública y conserva las URL', () => {
  assert.equal(anonymizePublicText('Linda: propiedad de Don Juan Pérez García; finca de Doña Ana López.'), 'Linda: propiedad de una persona particular; finca de una persona particular.');
  const row = sanitizePublicRecord({ description: 'Casa de Don Juan Pérez, calle Mayor 12, Valencia', towns: ['Valencia'], provinces: ['Valencia/València'], lots: 'Sin lotes', documentAnalysis: { points: [{ text: 'A nombre de Doña Ana López.' }], url: 'https://subastas.boe.es/' } });
  assert.equal(row.description, 'Inmueble en Valencia');
  assert.match(row.mapQuery, /calle Mayor 12/);
  assert.doesNotMatch(row.documentAnalysis.points[0].text, /Ana López/);
  assert.equal(row.documentAnalysis.url, 'https://subastas.boe.es/');
  assert.deepEqual(row.facts, { surfaceM2: null, surfaceKind: null, usefulSurfaceM2: null, appraisalValue: null, appraisalPricePerM2: null, habitual: 'unknown', occupancy: 'unknown', charges: 'unknown' });
});

test('extrae solo superficies, tasaciones y estados explícitos del documento', () => {
  const facts = deriveFacts({ description: 'Vivienda de 100 m² construidos', documentAnalysis: { points: [{ title: 'Datos', text: 'Valor de tasación: 200.000,00 €. No es vivienda habitual. Situación posesoria: desocupada. Sin cargas anteriores.' }] } });
  assert.equal(facts.surfaceM2, 100);
  assert.equal(facts.appraisalValue, 20000000);
  assert.equal(facts.appraisalPricePerM2, 2000);
  assert.deepEqual({ habitual: facts.habitual, occupancy: facts.occupancy, charges: facts.charges }, { habitual: 'no', occupancy: 'empty', charges: 'none' });
  assert.equal(deriveFacts({ documentAnalysis: { points: [{ text: 'No pudo comprobarse la ocupación; la parte declaró que no estaba arrendada ni ocupada.' }] } }).occupancy, 'unknown');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRecords } from '../src/search.mjs';
test('Búsqueda sin tildes, filtros combinados y valores desconocidos al final', () => {
  const row = { id:'SUB-JA-2015-1278', description:'Vivienda en Ávila', authority:'Juzgado', provinces:['Ávila'], towns:[], categories:['Inmuebles'], status:'Pasada', start:'2016-01-03T00:00:00+01:00', end:null, value:null };
  assert.equal(filterRecords([row], { query:'avila vivienda', year:'2016', category:'Inmuebles' }).length, 1);
  assert.equal(filterRecords([row], { state:'Activa' }).length, 0);
  assert.equal(filterRecords([row, {...row, id:'zero', value:0}], {sort:'value'})[0].id, 'zero');
});

test('filtra por municipio, superficie, tasación, €/m² y datos documentales', () => {
  const row = { id:'a', description:'Piso', authority:'Juzgado', provinces:['Valencia'], towns:['Gandía'], categories:['Inmuebles'], status:'Pasada', start:'2025-01-03', end:null, value:10000000, facts:{surfaceM2:100, appraisalValue:20000000, appraisalPricePerM2:2000, habitual:'yes', occupancy:'empty', charges:'present'} };
  assert.equal(filterRecords([row], {municipality:'GANDIA', minM2:'90', maxM2:'110', minAppraisal:'199000', maxAppraisal:'201000', minPriceM2:'1900', maxPriceM2:'2100', habitual:'yes', occupancy:'empty', charges:'present'}).length, 1);
  assert.equal(filterRecords([row], {municipality:'Valencia'}).length, 0);
  assert.equal(filterRecords([row], {minM2:'101'}).length, 0);
  assert.equal(filterRecords([row], {habitual:'unknown'}).length, 0);
});

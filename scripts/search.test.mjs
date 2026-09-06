import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRecords } from '../src/search.mjs';
test('Búsqueda sin tildes, filtros combinados y valores desconocidos al final', () => {
  const row = { id:'SUB-JA-2015-1278', description:'Vivienda en Ávila', authority:'Juzgado', provinces:['Ávila'], towns:[], categories:['Inmuebles'], status:'Pasada', start:'2016-01-03T00:00:00+01:00', end:null, value:null };
  assert.equal(filterRecords([row], { query:'avila vivienda', year:'2016', category:'Inmuebles' }).length, 1);
  assert.equal(filterRecords([row], { state:'Activa' }).length, 0);
  assert.equal(filterRecords([row, {...row, id:'zero', value:0}], {sort:'value'})[0].id, 'zero');
});

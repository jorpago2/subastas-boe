import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketReference } from '../src/market.mjs';
import { parseHistory } from './idealista.mjs';

test('barrio y distrito verificados, prioridad por operación y mes, dirección obsoleta descartada', () => {
  const row = { towns: ['Valencia'], start: '2025-01-10', mapQuery: 'Calle ejemplo, 1' };
  const location = { address: row.mapQuery, municipality: 'València', neighborhood: 'Aiora', district: 'Camins al Grau' };
  const municipal = { name: 'Valencia', operation: 'venta', months: { '2025-01': 2000 } };
  const district = { name: 'Camins al Grau', municipality: 'Valencia', level: 'district', operation: 'venta', months: { '2025-01': 2500 } };
  const barrio = { ...district, name: 'Aiora', level: 'neighborhood', months: { '2025-02': 3000 } };
  assert.equal(marketReference(row, [municipal, district, barrio], location).sale.value, 2500);
  assert.equal(marketReference({ ...row, start: '2025-02-10' }, [municipal, district, barrio], location).sale.value, 3000);
  assert.equal(marketReference(row, [municipal, district], { ...location, address: 'otra' }).sale.value, 2000);
  assert.equal(marketReference(row, [municipal, { ...district, municipality: 'Madrid' }], location).sale.value, 2000);
  assert.equal(marketReference(row, [municipal, district], location).rent, null);
});

test('tablas históricas: separadores españoles, ausencias y límite desde 2016', () => {
  assert.deepEqual(parseHistory('L3: Enero 2025 | 2.950 €/m2 | + 1 %\nFebrero 2025 | 14,2 €/m² | 0 %\nMarzo 2025 | n.d. | n.d.\nDiciembre 2015 | 1.500 €/m2'), { '2025-01': 2950, '2025-02': 14.2 });
  assert.deepEqual(parseHistory('Please enable JavaScript'), {});
});

test('referencias del mes de inicio y localidad exactos, sin reemplazar ausencias', () => {
  const reports = [{ name: 'València', operation: 'venta', months: { '2025-01': 2950 }, url: 'https://www.idealista.com/' }];
  const row = { towns: ['VALENCIA'], start: '2025-01-10T10:00:00Z' };
  assert.equal(marketReference(row, reports).sale.value, 2950);
  assert.equal(marketReference(row, reports).rent, null);
  assert.equal(marketReference({ ...row, start: '2025-02-01' }, reports).sale.value, null);
  assert.equal(marketReference({ ...row, towns: ['VAL'] }, reports).sale, null);
  assert.ok(marketReference({ ...row, towns: ['VALENCIA', 'GANDIA'] }, reports).reason);
  assert.ok(marketReference({ ...row, start: null }, reports).reason);
  assert.equal(marketReference({ ...row, start: '2024-12-31T23:30:00Z' }, reports).period, '2025-01');
  assert.equal(marketReference(row, [{ name: 'València', operation: 'venta', url: 'https://www.idealista.com/' }]).sale.recovered, false);
});

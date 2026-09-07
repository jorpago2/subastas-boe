import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inScope, scope } from '../src/scope.mjs';

test('excluye el vehículo documentado y conserva inmuebles y consultas del BOE', () => {
  assert.equal(inScope({ scope: scope.id, id: 'SUB-JV-2026-264894' }), false);
  assert.equal(inScope({ scope: scope.id, id: 'SUB-JA-2025-243864' }), true);
  assert.equal(inScope({ scope: scope.id }), true);
  assert.equal(inScope({ scope: 'otra-provincia' }), false);
});

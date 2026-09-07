import exclusions from '../data/analysis/scope-exclusions.json' with { type: 'json' };
export const excludedIds = new Set(exclusions.records.filter(r => r.excludeFromRealEstateCatalog).map(r => r.id));
export const scope = { id: 'valencia-inmuebles', category: 'Inmuebles', province: 'Valencia', provinceCode: '46' };
// La selección procede del filtro de bienes del BOE, no de la sede del juzgado.
export const inScope = record => record.scope === scope.id && !excludedIds.has(record.id);

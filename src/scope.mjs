import exclusions from '../data/analysis/scope-exclusions.json' with { type: 'json' };
import { deriveFacts } from './facts.mjs';
export const excludedIds = new Set(exclusions.records.filter(r => r.excludeFromRealEstateCatalog).map(r => r.id));
export const scope = { id: 'valencia-inmuebles', category: 'Inmuebles', province: 'Valencia', provinceCode: '46' };
// La selección procede del filtro de bienes del BOE, no de la sede del juzgado.
export const inScope = record => record.scope === scope.id && !excludedIds.has(record.id);

const honorificName = /\b(?:don|doña|dª)\s+[A-ZÁÉÍÓÚÜÑ][\p{L}'’-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}'’-]+){1,4}/giu;
const ownershipName = /\b(propiedad de|finca de|tierras de|solar de|terrenos de|casa de|herederos de|herencia de|adquirida por|vendida a)\s+(?:(?:hermanos|viuda|viudo|herederos)\s+)?[A-ZÁÉÍÓÚÜÑ][\p{L}'’-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}'’-]+){1,5}/giu;
const legalName = /\b(penado|deudor|ejecutad[oa]|demandad[oa]|propietari[oa]|titular(?:es)?)\s+(?:de\s+)?[A-ZÁÉÍÓÚÜÑ][\p{L}'’-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}'’-]+){1,4}/giu;

export const anonymizePublicText = value => {
  if (typeof value !== 'string' || /^https?:\/\//i.test(value)) return value;
  return value.replace(legalName, '$1 una persona particular').replace(ownershipName, '$1 una persona particular').replace(honorificName, 'persona particular');
};

const mapQuery = value => {
  if (typeof value !== 'string') return '';
  const firstLot = value.replace(/^.*?\bLote\s+1\s*:\s*/iu, '').split(/\bLote\s+2\s*:/iu)[0];
  return anonymizePublicText(firstLot.split(/\b(?:lind(?:a|e|ante|eros)?|inscripci[oó]n|valor de tasaci[oó]n)\b/iu)[0]).replace(/\s+/g, ' ').trim().slice(0, 320);
};

const anonymizeValue = value => Array.isArray(value)
  ? value.map(anonymizeValue)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, anonymizeValue(item)]))
    : anonymizePublicText(value);

export const sanitizePublicRecord = record => {
  const copy = structuredClone(record);
  const towns = Array.isArray(copy.towns) ? copy.towns.filter(Boolean).join(', ') : '';
  copy.description = `Inmueble${copy.lots && copy.lots !== 'Sin lotes' ? ' con varios lotes' : ''}${towns ? ` en ${towns}` : ''}`;
  copy.mapQuery = mapQuery(record.description) || [towns, Array.isArray(copy.provinces) ? copy.provinces.filter(Boolean).join(', ') : ''].filter(Boolean).join(', ');
  copy.facts = deriveFacts(record);
  copy.documentAnalysis = anonymizeValue(copy.documentAnalysis);
  return copy;
};

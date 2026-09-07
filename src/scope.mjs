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

export const propertyMapQuery = record => {
  const towns = [...new Set((record.towns || []).filter(Boolean))];
  if (towns.length !== 1 || (record.lots && record.lots !== 'Sin lotes')) return '';
  const description = String(record.description || '').split(/\b(?:linda|lindero|linderos|inscripci[oó]n)\b/iu)[0];
  // Solo calle y número: los pisos, fincas registrales y linderos no son direcciones.
  const matches = [...description.matchAll(/\b(calle|carrer|avenida|avinguda|paseo|passeig|plaza|plaça|cl|av|ps)\b[/.\s]+([\p{L}][\p{L}\s'’.-]{1,70}?)\s*(?:,\s*|\s+)(?:(?:n[úu]mero|n[º°o.]*)\s*)?(\d{1,4})(?!\d)/giu)];
  if (matches.length !== 1) return '';
  const [, type, street, number] = matches[0];
  const expanded = { cl: 'Calle', av: 'Avenida', ps: 'Paseo' }[type.toLowerCase()] || type;
  return `${expanded} ${street.trim()}, ${number}, ${towns[0]}, España`;
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
  copy.mapQuery = propertyMapQuery(record);
  copy.facts = deriveFacts(record);
  copy.documentAnalysis = anonymizeValue(copy.documentAnalysis);
  return copy;
};

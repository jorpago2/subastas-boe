export const normalize = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const inRange = (value, min, max, multiplier = 1) => {
  if (!min && !max) return true;
  if (!Number.isFinite(value)) return false;
  const lower = min ? Number(min) * multiplier : -Infinity;
  const upper = max ? Number(max) * multiplier : Infinity;
  return value >= lower && value <= upper;
};

export function filterRecords(records, { query = '', category = '', state = '', year = '', province = '', municipality = '', minM2 = '', maxM2 = '', minAppraisal = '', maxAppraisal = '', minPriceM2 = '', maxPriceM2 = '', habitual = '', occupancy = '', charges = '', sort = 'end' }) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return records.filter(row => (!category || row.categories.includes(category)) && (!state || row.status === state) && (!year || row.start?.startsWith(year)) && (!province || row.provinces.includes(province)) && (!municipality || (row.towns || []).some(town => normalize(town) === normalize(municipality))) && inRange(row.facts?.surfaceM2, minM2, maxM2) && inRange(row.facts?.appraisalValue, minAppraisal, maxAppraisal, 100) && inRange(row.facts?.appraisalPricePerM2, minPriceM2, maxPriceM2) && (!habitual || row.facts?.habitual === habitual) && (!occupancy || row.facts?.occupancy === occupancy) && (!charges || row.facts?.charges === charges) && words.every(word => normalize([row.id, row.description, row.authority, ...row.provinces, ...(row.towns || [])].join(' ')).includes(word))).sort((a, b) => {
    const av = sort === 'value' ? a.value : a[sort], bv = sort === 'value' ? b.value : b[sort];
    if (av == null) return bv == null ? a.id.localeCompare(b.id) : 1;
    if (bv == null) return -1;
    return sort === 'value' ? av - bv : sort === 'start' ? Date.parse(bv) - Date.parse(av) : Date.parse(av) - Date.parse(bv);
  });
}

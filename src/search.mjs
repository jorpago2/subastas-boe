export const normalize = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
export function filterRecords(records, { query = '', category = '', state = '', year = '', province = '', sort = 'end' }) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return records.filter(row => (!category || row.categories.includes(category)) && (!state || row.status === state) && (!year || row.start?.startsWith(year)) && (!province || row.provinces.includes(province)) && words.every(word => normalize([row.id, row.description, row.authority, ...row.provinces, ...row.towns].join(' ')).includes(word))).sort((a, b) => {
    const av = sort === 'value' ? a.value : a[sort], bv = sort === 'value' ? b.value : b[sort];
    if (av == null) return bv == null ? a.id.localeCompare(b.id) : 1;
    if (bv == null) return -1;
    return sort === 'value' ? av - bv : sort === 'start' ? Date.parse(bv) - Date.parse(av) : Date.parse(av) - Date.parse(bv);
  });
}

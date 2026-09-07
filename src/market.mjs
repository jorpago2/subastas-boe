export const zoneKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = { valencia: 'valencia', alcira: 'alzira', jativa: 'xativa', torrente: 'torrent', puzol: 'pucol', onteniente: 'ontinyent', villamarchante: 'vilamarxant', monserrat: 'monserrat', montserrat: 'monserrat', sagunto: 'saguntosagunt', sagunt: 'saguntosagunt', alboraya: 'alboraya', alboraia: 'alboraya' };
const canonical = value => aliases[zoneKey(value)] || zoneKey(value);

export function marketReference(row, reports, location = null) {
  const towns = [...new Set((row.towns || []).filter(Boolean).map(canonical))];
  if (towns.length !== 1) return { reason: 'No hay una localidad única identificada para consultar el mercado de vivienda.' };
  if (!row.start || !Number.isFinite(Date.parse(row.start))) return { reason: 'No consta la fecha de inicio para seleccionar el periodo histórico.' };
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Europe/Madrid' }).formatToParts(new Date(row.start));
  const period = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
  const verified = location && location.address === row.mapQuery && canonical(location.municipality) === towns[0] ? location : null;
  const local = reports.filter(report => {
    if (!report.level || report.level === 'municipality') return canonical(report.name) === towns[0];
    return verified && canonical(report.municipality) === towns[0] && (
      report.level === 'district' && zoneKey(report.name) === zoneKey(verified.district) ||
      report.level === 'neighborhood' && zoneKey(report.name) === zoneKey(verified.neighborhood));
  }).sort((a, b) => ({ neighborhood: 0, district: 1 }[a.level] ?? 2) - ({ neighborhood: 0, district: 1 }[b.level] ?? 2));
  const select = operation => {
    const candidates = local.filter(report => report.operation === operation);
    const report = candidates.find(report => report.months?.[period] > 0) || candidates.at(-1);
    return report ? { name: report.name, level: report.level || 'municipality', url: report.url, value: report.months?.[period] ?? null, recovered: !!report.months, retrievedAt: report.retrievedAt } : null;
  };
  return { period, location: verified, sale: select('venta'), rent: select('alquiler') };
}

import { readFile, writeFile } from 'node:fs/promises';
import { zoneKey } from '../src/market.mjs';

const base = 'https://geoportal.valencia.es/server/rest/services/OPENDATA/UrbanismoEInfraestructuras/MapServer';
async function query(layer, params) {
  const response = await fetch(`${base}/${layer}/query?${new URLSearchParams({ f: 'json', where: '1=1', outFields: '*', returnGeometry: 'false', ...params })}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Geoportal: ${response.status}`);
  const data = await response.json();
  if (data.error || !data.features) throw new Error(JSON.stringify(data.error || data));
  return data;
}
const streets = [];
for (let offset = 0; ; offset += 2000) {
  const page = await query(223, { resultOffset: offset, resultRecordCount: 2000, orderByFields: 'objectid', outFields: 'codvia,nomcalle,tipcalle' });
  streets.push(...page.features.map(f => f.attributes));
  if (!page.exceededTransferLimit) break;
}
const districts = (await query(225, {})).features.map(f => f.attributes);
const catalog = JSON.parse(await readFile('public/data/catalog.json', 'utf8'));
const rows = catalog.auctions || catalog.records;
if (!rows) throw new Error(`Unknown catalog: ${Object.keys(catalog)}`);
const assignments = {}, skipped = {}, cache = new Map();
for (const row of rows) {
  if (row.towns?.length !== 1 || zoneKey(row.towns[0]) !== 'valencia' || !row.mapQuery) continue;
  if (!cache.has(row.mapQuery)) {
    let result = null;
    const match = row.mapQuery.match(/^(Calle|Carrer|Avenida|Avinguda|Paseo|Passeig|Plaza|Plaça) (.+),\s*(\d+),\s*Val[eè]ncia,\s*España$/i);
    if (match) {
      const types = { calle: 'carrer', carrer: 'carrer', avenida: 'avinguda', avinguda: 'avinguda', paseo: 'passeig', passeig: 'passeig', plaza: 'placa', placa: 'placa' };
      const codes = [...new Set(streets.filter(s => zoneKey(s.nomcalle) === zoneKey(match[2]) && zoneKey(s.tipcalle) === types[zoneKey(match[1])]).map(s => s.codvia))];
      if (codes.length === 1) {
        const portals = (await query(217, { where: `codvia=${Number(codes[0])} AND numportal=${Number(match[3])}`, returnGeometry: 'true', outSR: 4326 })).features;
        if (portals.length === 1 && !portals[0].attributes.dupli_trip) {
          const portal = portals[0];
          const barrios = (await query(224, { geometry: `${portal.geometry.x},${portal.geometry.y}`, geometryType: 'esriGeometryPoint', inSR: 4326, spatialRel: 'esriSpatialRelIntersects' })).features;
          if (barrios.length === 1) {
            const barrio = barrios[0].attributes;
            const district = districts.find(d => d.coddistrit === barrio.coddistrit);
            if (district) result = { address: row.mapQuery, municipality: 'València', neighborhood: barrio.nombre, neighborhoodId: String(barrio.coddistbar), district: district.nombre, districtId: String(district.coddistrit), streetCode: codes[0], portalId: portal.attributes.objectid, coordinates: [portal.geometry.x, portal.geometry.y] };
          }
        }
      }
    }
    cache.set(row.mapQuery, result);
  }
  const result = cache.get(row.mapQuery);
  if (result) assignments[row.id] = result;
  else skipped[row.id] = 'Sin coincidencia única de calle, número y barrio oficiales';
}
await writeFile('public/data/property-neighborhoods.json', JSON.stringify({ retrievedAt: new Date().toISOString(), source: base, method: 'Calle y número exactos en portales municipales, intersección con barrios oficiales actuales', assignments, skipped }, null, 2));
console.log(JSON.stringify({ matched: Object.keys(assignments).length, skipped: Object.keys(skipped).length, districts: [...new Set(Object.values(assignments).map(a => a.district))] }));

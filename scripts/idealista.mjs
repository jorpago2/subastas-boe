import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export function parseHistory(text) {
  const values = {};
  for (const match of text.matchAll(/(?:^|\n)(?:L\d+:\s*)?([A-Za-z]+)\s+(20\d{2})\s*\|\s*([\d.,]+)\s*€\/m[2²]/g)) {
    const month = months.indexOf(match[1].toLowerCase()) + 1;
    const value = Number(match[3].replaceAll('.', '').replace(',', '.'));
    if (month && Number(match[2]) >= 2016 && Number.isFinite(value) && value > 0) values[`${match[2]}-${String(month).padStart(2, '0')}`] = value;
  }
  return values;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Indica el JSON de fuentes: [{name, url, operation, retrievedAt, text}]');
  const sources = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const reports = [], unavailable = [];
  for (const source of sources) {
    if (!/^https:\/\/www\.idealista\.com\/sala-de-prensa\/informes-precio-vivienda\/(venta|alquiler)\/comunitat-valenciana\/valencia-provincia\/[^/]+\/(?:[^/]+\/)?historico\/$/.test(source.url) || !['venta', 'alquiler'].includes(source.operation) || !source.url.includes(`/${source.operation}/`)) throw new Error(`Fuente inválida: ${source.url}`);
    const { text, ...metadata } = source;
    const months = parseHistory(text);
    if (!Object.keys(months).length) unavailable.push(metadata);
    else reports.push({ ...metadata, months });
  }
  if (!reports.length) throw new Error('Ninguna tabla histórica válida; se conserva el archivo anterior.');
  const result = { source: 'Informes de precios de Idealista', retrievedAt: new Date().toISOString(), coverage: 'partial', reports, unavailable };
  await writeFile('public/data/idealista-history.json', JSON.stringify(result));
  console.log(`${reports.length} informes; ${unavailable.length} sin tabla recuperable; ${reports.reduce((n, r) => n + Object.keys(r.months).length, 0)} valores mensuales.`);
}

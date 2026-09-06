import { load } from 'cheerio';

export const origin = 'https://subastas.boe.es/';
export const clean = value => value.replace(/\s+/g, ' ').trim();
export function money(value = '') {
  const match = value.match(/^(\d[\d.]*,\d{2})\s*€/);
  return match ? Math.round(Number(match[1].replaceAll('.', '').replace(',', '.')) * 100) : null;
}
export function status(text) {
  if (/cancelada/i.test(text)) return 'Cancelada';
  if (/suspendida/i.test(text)) return 'Suspendida';
  if (/finalizada|concluida|pendiente de finalización/i.test(text)) return 'Pasada';
  if (/celebrándose/i.test(text)) return 'Activa';
  if (/próxima|apertura/i.test(text)) return 'Próxima';
  return 'Sin confirmar';
}
export function parseListing(html) {
  const $ = load(html);
  const rows = $('.resultado-busqueda').toArray().map(element => {
    const item = $(element);
    const id = item.find('h3').text().match(/SUB-[A-Z]+-\d{4}-[A-Z0-9]+/i)?.[0];
    if (!id) throw new Error('Resultado sin identificador: estructura BOE inesperada');
    const paragraphs = item.children('p').toArray().map(p => clean($(p).text()));
    const state = paragraphs.find(p => p.startsWith('Estado:'))?.replace(/^Estado:\s*/, '') || '';
    return { id, authority: clean(item.find('h4').text()), description: paragraphs.filter(p => !/^(Estado|Expediente):/.test(p)).join(' '), statusText: state, status: status(state), url: `${origin}detalleSubasta.php?idSub=${id}` };
  });
  const countText = clean($('.paginar').first().text());
  const totalMatch = countText.match(/Resultados\s+[\d.]+\s+a\s+[\d.]+\s+de\s+([\d.]+)/i);
  const total = totalMatch ? Number(totalMatch[1].replaceAll('.', '')) : null;
  if (!rows.length && !/no se han encontrado|no se ha encontrado|no hay resultados|ning[uú]n resultado/i.test($('#contenido').text())) throw new Error('BOE no devolvió un listado reconocible');
  const nextHref = $('.paginar2 a').toArray().find(a => /siguiente/i.test($(a).text()));
  return { rows, total: total ?? (rows.length ? null : 0), next: nextHref ? new URL($(nextHref).attr('href'), origin).href : null };
}
export function parseDetail(html, id) {
  const $ = load(html);
  const data = {};
  $('#idBloqueDatos1 tr').each((_, row) => { data[clean($(row).find('th').text())] = clean($(row).find('td').text()); });
  if (data.Identificador !== id) throw new Error(`Ficha inesperada: ${id}`);
  const iso = text => text?.match(/ISO:\s*([^\s)]+)/)?.[1] || null;
  return { start: iso(data['Fecha de inicio']), end: iso(data['Fecha de conclusión']), value: money(data['Valor subasta']), deposit: money(data['Importe del depósito']), minimumBid: money(data['Puja mínima']), minimumBidText: data['Puja mínima'] || null, lots: data.Lotes || null, auctionType: data['Tipo de subasta'] || null, announcement: data['Anuncio BOE']?.match(/BOE-B-\d+-\d+/)?.[0] || null };
}
export function parseGoods(html) {
  const $ = load(html);
  const provinces = new Set(), towns = new Set();
  $('#idBloqueDatos3 tr').each((_, row) => {
    const key = clean($(row).find('th').text()), value = clean($(row).find('td').text());
    if (key === 'Provincia' && value) provinces.add(value);
    if (key === 'Localidad' && value) towns.add(value);
  });
  return { provinces: [...provinces], towns: [...towns] };
}

export function parseOutcome(html, id) {
  const $ = load(html);
  if (clean($('#contenido > h2').text()) !== `Subasta ${id}`) throw new Error(`Resultado inesperado: ${id}`);
  const block = $('#idBloqueDatos8');
  if (!block.length) throw new Error(`Sección de pujas no reconocida: ${id}`);
  const text = clean(block.text());
  const lotBids = block.find('tbody tr').toArray().map(row => {
    const lot = clean($(row).find('[headers="lote"]').text());
    const amount = clean($(row).find('[headers="cantidad"]').text());
    if (!lot) throw new Error(`Tabla de lotes no reconocida: ${id}`);
    return { lot, highestBid: money(amount), status: /sin puja/i.test(amount) ? 'Sin pujas' : money(amount) !== null ? 'Con pujas' : 'No publicado' };
  });
  const noBids = /la subasta no ha recibido pujas/i.test(text);
  const highestBid = lotBids.length ? null : money(clean(block.find('strong.destaca').text()));
  return { status: lotBids.length ? 'Por lotes' : noBids ? 'Sin pujas' : highestBid !== null ? 'Con pujas' : 'No publicado', highestBid, lotBids, source: `${origin}detalleSubasta.php?idSub=${id}&ver=5`, checkedAt: new Date().toISOString() };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money, status, parseListing, parseDetail, parseOutcome } from './boe.mjs';
test('Importes en céntimos y estados oficiales, sin inferir fechas', () => {
  assert.equal(money('172.000,00 €'), 17200000);
  assert.equal(money('0,00 €'), 0);
  assert.equal(money('Sin puja mínima'), null);
  assert.equal(status('Finalizada y depósitos con reserva devueltos'), 'Pasada');
  assert.equal(status('Suspendida'), 'Suspendida');
  assert.equal(status('Próxima apertura'), 'Próxima');
  assert.equal(status('Texto nuevo'), 'Sin confirmar');
  assert.equal(status('Pendiente de finalización y devolución de depósitos con reserva'), 'Pasada');
});
test('Resultados: distingue sin pujas, importe publicado y lotes con importe vacío', () => {
  const wrap = body => `<div id="contenido"><h2>Subasta SUB-JA-2015-842</h2><div id="idBloqueDatos8">${body}</div></div>`;
  assert.equal(parseOutcome(wrap('<p>La subasta no ha recibido pujas.</p>'), 'SUB-JA-2015-842').status, 'Sin pujas');
  const bid = parseOutcome(wrap('<strong class="destaca">5.500,00 €</strong>'), 'SUB-JA-2015-842');
  assert.equal(bid.highestBid, 550000);
  assert.equal(bid.status, 'Con pujas');
  const lots = parseOutcome(wrap('<table><tbody><tr><td headers="lote">1</td><td headers="cantidad"></td></tr><tr><td headers="lote">2</td><td headers="cantidad">Sin puja</td></tr></tbody></table>'), 'SUB-JA-2015-842');
  assert.equal(lots.status, 'Por lotes');
  assert.equal(lots.highestBid, null);
  assert.deepEqual(lots.lotBids.map(lot => lot.status), ['No publicado','Sin pujas']);
  assert.throws(() => parseOutcome('<html>Acceso denegado</html>', 'SUB-JA-2015-842'));
});
test('Falla ante respuestas ajenas al catálogo, conserva total y paginación', () => {
  assert.throws(() => parseListing('<html>Acceso denegado</html>'));
  const result = parseListing('<div class="paginar">Resultados 1 a 50 de 1.200</div><li class="resultado-busqueda"><h3>SUBASTA SUB-JA-2015-1278</h3><p>Estado: Finalizada</p><p>Casa</p></li><div class="paginar2"><a href="subastas_ava.php?accion=Mas&amp;page=2">Pág. siguiente</a></div>');
  assert.equal(result.total, 1200);
  assert.equal(result.rows[0].description, 'Casa');
  assert.ok(result.next.endsWith('accion=Mas&page=2'));
  assert.equal(parseListing('<li class="resultado-busqueda"><h3>SUBASTA SUB-AT-2026-25R2986001105</h3></li>').rows[0].id, 'SUB-AT-2026-25R2986001105');
  const detail = parseDetail('<div id="idBloqueDatos1"><table><tr><th>Identificador</th><td>SUB-JA-2015-1278</td></tr><tr><th>Fecha de inicio</th><td>03-01-2016 (ISO: 2016-01-03T00:00:00+01:00)</td></tr></table></div>', 'SUB-JA-2015-1278');
  assert.equal(detail.start.slice(0,4), '2016');
  assert.equal(detail.value, null);
  assert.throws(() => parseDetail('<html>Ficha eliminada</html>', 'SUB-JA-2015-1278'));
});

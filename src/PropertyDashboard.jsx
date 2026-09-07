import React from 'react';
import { Tag } from '@carbon/react';
import MarketReference from './MarketReference.jsx';
import { article670Url, auctionMetrics } from './auction.mjs';

export default function PropertyDashboard({ row, currency, date, factValue }) {
  const facts = row.facts;
  const { auctionPricePerM2, threshold70, threshold60, threshold50, threshold40, highestBid, highestBidOutcome } = auctionMetrics(row);
  const general50Label = facts?.habitual === 'yes' ? 'Regla general si no fuera vivienda habitual (≥ 50 %)' : 'Sin mejora, regla general (≥ 50 %)';
  const general40Label = facts?.habitual === 'yes' ? 'Regla general si no fuera vivienda habitual (≥ 40 %)' : 'Satisfacción completa, suelo general (≥ 40 %)';
  const metrics = [
    ['Valor de subasta', currency(row.value), 'Importe de referencia del BOE'],
    ['Valor de subasta por m²', auctionPricePerM2 != null ? `${auctionPricePerM2.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €/m²` : 'No consta', 'Calculado con el valor de subasta y la superficie publicada'],
    ...(facts?.appraisalValue != null ? [['Tasación publicada', currency(facts.appraisalValue), 'Tasación documental, no valoración de mercado']] : []),
    ['Superficie publicada', facts?.surfaceM2 ? `${facts.surfaceM2.toLocaleString('es-ES')} m²` : 'No consta', facts?.surfaceKind ? `Superficie ${facts.surfaceKind}` : 'Sin superficie identificada'],
    ...(facts?.appraisalPricePerM2 != null ? [['Tasación por m²', `${facts.appraisalPricePerM2.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €/m²`, 'Calculada con la tasación y superficie disponibles']] : []),
  ];
  const situations = [
    ['occupancy', 'Ocupación', 'Situación indicada en la documentación'],
    ['charges', 'Cargas', 'Los indicios no cuantifican la deuda pendiente'],
    ['habitual', 'Vivienda habitual', 'Condición documentada de la vivienda'],
  ];
  return <section className="property-dashboard" aria-label="Resumen del inmueble">
    <div className="dashboard-heading"><h4>El inmueble, de un vistazo</h4><span>Datos comprobados: {date(row.checkedAt)}</span></div>
    <dl className="dashboard-metrics">{metrics.map(([label, value, note]) => <div key={label} className={value === 'No consta' ? 'dashboard-metric is-unknown' : 'dashboard-metric'}><dt>{label}</dt><dd>{value}</dd><p>{note}</p></div>)}</dl>
    <MarketReference row={row}/><section className="auction-threshold" aria-label="Artículo 670: umbrales de remate"><h4>Artículo 670: umbrales de remate</h4>{threshold70 != null ? <><dl><div><dt>Remate directo al mejor postor (≥ 70 %)</dt><dd>{currency(threshold70)}</dd></div><div><dt>Mejora de tercero si queda por debajo (≥ 60 %)</dt><dd>{currency(threshold60)}</dd></div><div><dt>{general50Label}</dt><dd>{currency(threshold50)}</dd></div><div><dt>{general40Label}</dt><dd>{currency(threshold40)}</dd></div></dl><p>{highestBid == null ? 'La puja máxima aún no consta.' : highestBidOutcome === 'direct70' ? 'La puja máxima alcanza el 70 %: el artículo 670.1 prevé la aprobación del remate al mejor postor.' : highestBidOutcome === 'habitual60' ? 'Está por debajo del 70 %. Al tratarse de vivienda habitual, el artículo 670 exige condiciones adicionales y fija un mínimo del 60 % cuando se aplica la excepción por deuda.' : highestBidOutcome === 'habitualReview' ? 'Está por debajo del 60 %. Al tratarse de vivienda habitual, no se puede aplicar la excepción por deuda con los datos disponibles; la aprobación queda sujeta al procedimiento.' : highestBidOutcome === 'afterImprovement50' ? 'Está por debajo del 70 %. Tras el plazo de mejora sin efecto, el artículo 670 permite aprobar el remate al mejor postor desde el 50 %.' : highestBidOutcome === 'satisfaction40' ? 'Está por debajo del 50 %. Solo podría aprobarse desde el 40 % si permite satisfacer íntegramente el derecho del ejecutante.' : 'No alcanza los mínimos cuantitativos anteriores; la aprobación queda a la decisión del letrado o letrada de la Administración de Justicia.'}</p>{facts?.habitual === 'yes' && <p>Vivienda habitual: el artículo 670 no permite aprobar por debajo del 70 %, salvo la excepción por deuda, con mínimo del 60 %.</p>}</> : <p>No se puede calcular: la subasta no tiene un valor único publicado, normalmente por estar dividida en lotes.</p>}<p className="dashboard-note">Son importes calculados sobre el valor de subasta publicado. La puja máxima no acredita por sí sola la adjudicación. <a href={article670Url} target="_blank" rel="noreferrer">Consultar el artículo 670 vigente ↗</a></p></section><div className="dashboard-situations">{situations.map(([key, label, note]) => <div key={key}><h5>{label}</h5><Tag type={facts?.[key] === 'occupied' || facts?.[key] === 'present' ? 'warm-gray' : 'gray'}>{factValue(facts, key)}</Tag><p>{note}</p></div>)}</div>
    <div className="dashboard-bottom">
      <section aria-label="Condiciones para pujar"><h5>Para participar</h5><dl><div><dt>Depósito</dt><dd>{currency(row.deposit)}</dd></div><div><dt>Puja mínima</dt><dd>{row.minimumBidText || 'No consta'}</dd></div></dl></section>
      <section aria-label="Fechas de la subasta"><h5>Calendario de la subasta</h5><dl><div><dt>Inicio</dt><dd>{date(row.start)}</dd></div><div><dt>Cierre</dt><dd>{date(row.end)}</dd></div></dl></section>
    </div>
    <p className="dashboard-note">«No consta» significa que no se ha recuperado el dato.{row.lots && row.lots !== 'Sin lotes' ? ' Esta subasta contiene varios lotes: las cifras no deben interpretarse como las de un único inmueble.' : ''}</p>
  </section>;
}

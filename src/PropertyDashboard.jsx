import React from 'react';
import { Tag } from '@carbon/react';
import MarketReference from './MarketReference.jsx';

export default function PropertyDashboard({ row, currency, date, factValue }) {
  const facts = row.facts;
  const metrics = [
    ['Valor de subasta', currency(row.value), 'Importe de referencia del BOE'],
    ['Tasación publicada', currency(facts?.appraisalValue), 'Tasación documental, no valoración de mercado'],
    ['Superficie publicada', facts?.surfaceM2 ? `${facts.surfaceM2.toLocaleString('es-ES')} m²` : 'No consta', facts?.surfaceKind ? `Superficie ${facts.surfaceKind}` : 'Sin superficie identificada'],
    ['Tasación por m²', facts?.appraisalPricePerM2 != null ? `${facts.appraisalPricePerM2.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €/m²` : 'No consta', 'Calculada con la tasación y superficie disponibles'],
  ];
  const situations = [
    ['occupancy', 'Ocupación', 'Situación indicada en la documentación'],
    ['charges', 'Cargas', 'Los indicios no cuantifican la deuda pendiente'],
    ['habitual', 'Vivienda habitual', 'Condición documentada de la vivienda'],
  ];
  return <section className="property-dashboard" aria-label="Resumen del inmueble">
    <div className="dashboard-heading"><h4>El inmueble, de un vistazo</h4><span>Datos comprobados: {date(row.checkedAt)}</span></div>
    <dl className="dashboard-metrics">{metrics.map(([label, value, note]) => <div key={label} className={value === 'No consta' ? 'dashboard-metric is-unknown' : 'dashboard-metric'}><dt>{label}</dt><dd>{value}</dd><p>{note}</p></div>)}</dl>
    <MarketReference row={row}/><div className="dashboard-situations">{situations.map(([key, label, note]) => <div key={key}><h5>{label}</h5><Tag type={facts?.[key] === 'occupied' || facts?.[key] === 'present' ? 'warm-gray' : 'gray'}>{factValue(facts, key)}</Tag><p>{note}</p></div>)}</div>
    <div className="dashboard-bottom">
      <section aria-label="Condiciones para pujar"><h5>Para participar</h5><dl><div><dt>Depósito</dt><dd>{currency(row.deposit)}</dd></div><div><dt>Puja mínima</dt><dd>{row.minimumBidText || 'No consta'}</dd></div></dl></section>
      <section aria-label="Fechas de la subasta"><h5>Calendario de la subasta</h5><dl><div><dt>Inicio</dt><dd>{date(row.start)}</dd></div><div><dt>Cierre</dt><dd>{date(row.end)}</dd></div></dl></section>
    </div>
    <p className="dashboard-note">«No consta» significa que no se ha recuperado el dato.{row.lots && row.lots !== 'Sin lotes' ? ' Esta subasta contiene varios lotes: las cifras no deben interpretarse como las de un único inmueble.' : ''}</p>
  </section>;
}

import React, { useEffect, useState } from 'react';
import { marketReference } from './market.mjs';

export default function MarketReference({ row }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [geography, setGeography] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/property-neighborhoods.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Barrios no disponibles'); return response.json(); })
      .then(setGeography).catch(() => {});
    fetch(`${import.meta.env.BASE_URL}data/idealista-history.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Informe no disponible'); return response.json(); })
      .then(value => { if (!Array.isArray(value.reports)) throw new Error('Informe inválido'); setData(value); })
      .catch(error => { if (error.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, []);
  const reference = data ? marketReference(row, [...data.reports, ...(data.unavailable || [])], geography?.assignments?.[row.id]) : null;
  return <section className="market-reference" aria-label="Mercado de vivienda según Idealista">
    <h4>Mercado de vivienda en la zona</h4>
    {!reference ? <p role="status">{error ? 'No se pudieron cargar los informes de Idealista.' : 'Cargando referencias de Idealista…'}</p> : reference.reason ? <p>{reference.reason}</p> : <>
      <p>{row.towns.join(', ')} · {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${reference.period}-01`))}</p>
      {reference.location ? <p>Barrio: <strong>{reference.location.neighborhood}</strong> · Distrito: <strong>{reference.location.district}</strong>. <a href={geography.source} target="_blank" rel="noreferrer">Fuente municipal ↗</a></p> : <p className="dashboard-note">Barrio sin verificar.</p>}
      <dl className="market-metrics">{[['Venta anunciada', reference.sale, '€/m²'], ['Alquiler anunciado', reference.rent, '€/m²/mes']].map(([label, report, unit]) => <div key={label}>
        <dt>{label}</dt><dd>{report?.value != null ? <>{report.value.toLocaleString('es-ES')} <small>{unit}</small></> : report ? report.recovered ? 'Sin dato para este mes' : 'Histórico pendiente de recuperar' : 'Sin informe de esta localidad'}</dd>
        {report && <><p>{({ municipality: 'Municipio', district: 'Distrito', neighborhood: 'Barrio' })[report.level]}: {report.name}</p><a href={report.url} target="_blank" rel="noreferrer">Ver histórico de Idealista ↗</a><p className="dashboard-note">Consultado: {new Intl.DateTimeFormat('es-ES', { dateStyle: 'short' }).format(new Date(report.retrievedAt))}</p></>}
      </div>)}</dl>
      <p className="dashboard-note">Referencia del mes de inicio de la subasta; no se dispone de la fecha del anuncio. Se usa la zona más concreta con datos de ese mes: barrio, distrito o municipio. Los barrios se comprueban con calle y número en la cartografía municipal actual; los históricos recuperados de Valencia llegan al nivel de distrito.</p>
    </>}
    <p className="dashboard-note">Fuente: informes de precios de Idealista. Precios de oferta de viviendas, no de operaciones cerradas ni una valoración del bien subastado. No son comparables para locales, garajes o terrenos.</p>
  </section>;
}

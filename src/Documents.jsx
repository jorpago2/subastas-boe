import React from 'react';
import { Link } from '@carbon/react';
import { ArrowUpRight } from '@carbon/react/icons';

export function DocumentSummary({ row }) {
  const analysis = row.documentAnalysis;
  if (!analysis) return null;
  return <section className="document-summary" aria-label="Resumen de los documentos">
    <h4>Los documentos, en pocas palabras</h4>
    <ul>{analysis.points.map(point => <li key={point.title}><strong>{point.title}.</strong> {point.text}</li>)}</ul>
    <p className="detail-note">{analysis.limitations}</p>
    <details><summary>Fuentes del resumen · {analysis.sources.length} PDF {analysis.sources.length === 1 ? 'revisado' : 'revisados'}</summary>
      <ul>{analysis.sources.map(source => <li key={source.url}><Link href={source.url} target="_blank" rel="noreferrer">{source.title}</Link> · {source.pages} {source.pages === 1 ? 'página' : 'páginas'}{source.date && ` · documento de ${source.date}`}</li>)}</ul>
      {analysis.portalSource && <Link href={analysis.portalSource} target="_blank" rel="noreferrer">Ficha del BOE e información adicional</Link>}
      <p className="detail-note">{analysis.points.map(point => `${point.title}: ${point.evidence}`).join(' · ')}</p>
    </details>
  </section>;
}

export default function Documents({ row }) {
  const docs = row.documents;
  const items = [...(docs?.items || []), ...(row.authenticatedDocuments?.items || [])];
  return <section className="documents" aria-label="Documentación y anexos">
    <h4>Documentación y anexos</h4>
    {docs?.status === 'unavailable' ? <p>El BOE indica que los anexos de esta subasta ya no son accesibles. Iniciar sesión no recupera los documentos retirados.</p> : <p>Los documentos se abren en el BOE y pueden requerir iniciar sesión. Revisa también los anexos de cada bien o lote.</p>}
    {items.length > 0 && <ul>{items.map(item => <li key={item.url}><Link href={item.url} target="_blank" rel="noreferrer" renderIcon={ArrowUpRight}>{item.title}</Link></li>)}</ul>}
    {!docs && <p>Documentación pendiente de consultar.</p>}
    {row.authenticatedDocuments && <p className="detail-note">Enlaces a los documentos consultados con sesión del BOE.</p>}
    <Link href={docs?.source || row.url} target="_blank" rel="noreferrer">Consultar documentación general en el BOE</Link><br/>
    <Link href={`${row.url}&ver=3`} target="_blank" rel="noreferrer">Consultar documentación de bienes y lotes</Link>
  </section>;
}

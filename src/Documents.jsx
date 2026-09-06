import React from 'react';
import { Link } from '@carbon/react';
import { ArrowUpRight } from '@carbon/react/icons';

export default function Documents({ row }) {
  const docs = row.documents;
  const items = [...(docs?.items || []), ...(row.authenticatedDocuments?.items || [])];
  return <section className="documents" aria-label="Documentación y anexos">
    <h4>Documentación y anexos</h4>
    {docs?.status === 'unavailable' ? <p>El BOE indica que los anexos de esta subasta ya no son accesibles. Iniciar sesión no recupera los documentos retirados.</p> : <p>Los documentos se abren en el BOE y pueden requerir iniciar sesión. Revisa también los anexos de cada bien o lote.</p>}
    {items.length > 0 && <ul>{items.map(item => <li key={item.url}><Link href={item.url} target="_blank" rel="noreferrer" renderIcon={ArrowUpRight}>{item.title}</Link></li>)}</ul>}
    {!docs && <p>Documentación pendiente de consultar.</p>}
    {row.authenticatedDocuments && <p className="detail-note">Listado parcial de anexos identificado con sesión del BOE.</p>}
    <Link href={docs?.source || row.url} target="_blank" rel="noreferrer">Consultar documentación general en el BOE</Link><br/>
    <Link href={`${row.url}&ver=3`} target="_blank" rel="noreferrer">Consultar documentación de bienes y lotes</Link>
  </section>;
}

import React from 'react';

const amount = cents => new Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR'}).format(cents / 100);
export default function Outcome({ row, compact = false }) {
  if (row.status !== 'Pasada') return null;
  const result = row.authenticatedOutcome || row.outcome;
  const label = !result ? 'Pendiente de consultar' : result.status === 'Con pujas' ? `Puja máxima: ${amount(result.highestBid)}` : result.status === 'Por lotes' ? 'Resultado por lotes' : result.status === 'No publicado' ? 'Pujas: dato no publicado' : 'Sin pujas';
  if (compact) return <p className="outcome-summary">{label}</p>;
  return <section className="outcome" aria-label="Resultado de la subasta">
    <h4>Cómo terminó</h4><p>{label}</p>
    {!!result?.lotBids.length && <div className="coverage-table"><table><thead><tr><th>Lote</th><th>Resultado de las pujas</th></tr></thead><tbody>{result.lotBids.map(lot => <tr key={lot.lot}><td>{lot.lot}</td><td>{lot.status === 'Con pujas' ? amount(lot.highestBid) : lot.status}</td></tr>)}</tbody></table></div>}
    <p className="outcome-note">Adjudicación definitiva: no confirmada en los datos recuperados. La puja máxima no acredita el precio de adjudicación.</p>
    {row.authenticatedOutcome && <p className="outcome-note">Importes consultados con sesión del BOE. El enlace de origen puede requerir iniciar sesión.</p>}
    {result && <p className="outcome-source"><a href={result.source} target="_blank" rel="noreferrer">Consultar pujas en el BOE ↗</a> · Comprobado el {new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeZone:'Europe/Madrid'}).format(new Date(result.checkedAt))}</p>}
  </section>;
}

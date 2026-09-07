export const article670Url = 'https://boe.es/buscar/act.php?id=BOE-A-2025-76';
const atLeastPercent = (value, percent) => Math.ceil(value * percent / 100);

export function auctionMetrics(row) {
  const value = Number.isSafeInteger(row.value) && row.value > 0 ? row.value : null;
  const surface = Number.isFinite(row.facts?.surfaceM2) && row.facts.surfaceM2 > 0 ? row.facts.surfaceM2 : null;
  const threshold70 = value == null ? null : atLeastPercent(value, 70);
  const threshold60 = value == null ? null : atLeastPercent(value, 60);
  const threshold50 = value == null ? null : atLeastPercent(value, 50);
  const threshold40 = value == null ? null : atLeastPercent(value, 40);
  const auctionPricePerM2 = value != null && surface != null ? value / 100 / surface : null;
  const result = row.certifiedOutcome || row.authenticatedOutcome || row.outcome;
  const highestBid = result?.lotBids?.length ? null : Number.isSafeInteger(result?.highestBid) ? result.highestBid : null;
  let highestBidOutcome = null;
  if (highestBid != null && threshold70 != null) {
    if (highestBid >= threshold70) highestBidOutcome = 'direct70';
    else if (row.facts?.habitual === 'yes') highestBidOutcome = highestBid >= threshold60 ? 'habitual60' : 'habitualReview';
    else if (highestBid >= threshold50) highestBidOutcome = 'afterImprovement50';
    else if (highestBid >= threshold40) highestBidOutcome = 'satisfaction40';
    else highestBidOutcome = 'review';
  }
  return {
    auctionPricePerM2,
    threshold70,
    threshold60,
    threshold50,
    threshold40,
    highestBid,
    highestBidReaches70: threshold70 != null && highestBid != null && highestBid >= threshold70,
    highestBidOutcome,
  };
}

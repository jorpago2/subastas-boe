import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auctionMetrics } from '../src/auction.mjs';

test('calcula valor de subasta por m² y el menor céntimo que alcanza el 70%', () => {
  const row = { value: 10000000, facts: { surfaceM2: 100 }, outcome: { status: 'Con pujas', highestBid: 7000000, lotBids: [] } };
  assert.equal(auctionMetrics(row).auctionPricePerM2, 1000);
  assert.equal(auctionMetrics(row).threshold70, 7000000);
  assert.equal(auctionMetrics(row).threshold60, 6000000);
  assert.equal(auctionMetrics(row).threshold50, 5000000);
  assert.equal(auctionMetrics(row).threshold40, 4000000);
  assert.equal(auctionMetrics(row).highestBidReaches70, true);
  assert.equal(auctionMetrics(row).highestBidOutcome, 'direct70');
  assert.equal(auctionMetrics({ ...row, value: 1 }).threshold70, 1);
  assert.equal(auctionMetrics({ ...row, outcome: { ...row.outcome, highestBid: 6999999 } }).highestBidOutcome, 'afterImprovement50');
  assert.equal(auctionMetrics({ ...row, outcome: { ...row.outcome, highestBid: 4500000 } }).highestBidOutcome, 'satisfaction40');
  assert.equal(auctionMetrics({ ...row, outcome: { ...row.outcome, highestBid: 3900000 } }).highestBidOutcome, 'review');
  assert.equal(auctionMetrics({ ...row, facts: { surfaceM2: 100, habitual: 'yes' }, outcome: { ...row.outcome, highestBid: 6500000 } }).highestBidOutcome, 'habitual60');
  assert.equal(auctionMetrics({ ...row, facts: { surfaceM2: 100, habitual: 'yes' }, outcome: { ...row.outcome, highestBid: 5500000 } }).highestBidOutcome, 'habitualReview');
  assert.equal(auctionMetrics({ ...row, facts: { surfaceM2: null }, outcome: { ...row.outcome, lotBids: [{ lot: '1', highestBid: 7000000 }] } }).auctionPricePerM2, null);
});

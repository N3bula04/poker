const assert = require('node:assert/strict');
const test = require('node:test');
const { computePots, settlePots, splitPayout } = require('../pot');

const player = (totalBet, stack = 1000 - totalBet, folded = false) => ({
  stack, totalBet, folded, out: false,
});
const amounts = pots => pots.map(pot => pot.amount);

test('an opening bet of 8 after four antes of 2 stays in one pot', () => {
  const pots = computePots([player(2), player(10), player(2), player(2)]);
  assert.deepEqual(amounts(pots), [16]);
  assert.deepEqual(pots[0].eligible, [0, 1, 2, 3]);
});

test('live pot stays whole as callers start matching the opening bet', () => {
  assert.deepEqual(amounts(computePots([player(2), player(10), player(10), player(2)])), [24]);
  assert.deepEqual(amounts(computePots(Array.from({ length: 4 }, () => player(10)))), [40]);
});

test('four matched bets of 8 contribute 32 before adding any antes', () => {
  assert.deepEqual(amounts(computePots(Array.from({ length: 4 }, () => player(8)))), [32]);
});

test('two lower all-in caps with an unmatched top layer', () => {
  const live = computePots([player(50, 0), player(100, 0), player(200, 0)]);
  assert.deepEqual(amounts(live), [150, 100, 100]);
  const { awardable, refunds } = settlePots(live);
  assert.deepEqual(amounts(awardable), [150, 100]);
  assert.deepEqual(refunds, [[{ seat: 2, amount: 100 }]]);
});

test('three all-in levels of 50, 100 and 150 produce a live 50-chip tail', () => {
  const live = computePots([player(50, 0), player(100, 0), player(150, 0)]);
  assert.deepEqual(amounts(live), [150, 100, 50]);
  const { awardable, refunds } = settlePots(live);
  assert.deepEqual(amounts(awardable), [150, 100]);
  assert.deepEqual(refunds, [[{ seat: 2, amount: 50 }]]);
});

test('a fourth player matching the highest all-in makes all three pots awardable', () => {
  const live = computePots([player(50, 0), player(100, 0), player(150, 0), player(150)]);
  const { awardable, refunds } = settlePots(live);
  assert.deepEqual(amounts(awardable), [200, 150, 100]);
  assert.deepEqual(refunds, []);
});

test('odd chips go clockwise starting left of the dealer', () => {
  assert.deepEqual(splitPayout(5, [0, 2], 0, 4), new Map([[0, 2], [2, 3]]));
  assert.deepEqual(splitPayout(7, [3, 0, 2], 0, 4), new Map([[0, 2], [2, 3], [3, 2]]));
  assert.deepEqual(splitPayout(8, [0, 1, 3], 2, 4), new Map([[0, 3], [1, 2], [3, 3]]));
});

test('fold-out returns the opening bet and awards the dead antes', () => {
  const players = [player(2, 998, true), player(10), player(2, 998, true), player(2, 998, true)];
  const { awardable, refunds } = settlePots(computePots(players));
  assert.deepEqual(amounts(awardable), [8]);
  assert.deepEqual(awardable[0].eligible, [1]);
  assert.deepEqual(refunds, [[{ seat: 1, amount: 8 }]]);
  assert.equal(players[1].stack + awardable[0].amount + refunds[0][0].amount, 1006);
});

test('a live side pot accounts for partially matched bets and folded chips', () => {
  const live = computePots([player(10, 0), player(20), player(12, 988, true), player(2)]);
  assert.deepEqual(amounts(live), [32, 12]);
  assert.deepEqual(live.map(pot => pot.eligible), [[0, 1, 3], [1]]);
  const { awardable, refunds } = settlePots(live);
  assert.deepEqual(amounts(awardable), [32, 4]);
  assert.deepEqual(refunds, [[{ seat: 1, amount: 8 }]]);
});

test('a layer with no eligible players returns each actual contribution', () => {
  const live = computePots([player(10, 0), player(19, 981, true), player(12, 988, true)]);
  const { awardable, refunds } = settlePots(live);
  assert.deepEqual(amounts(awardable), [30]);
  assert.deepEqual(refunds, [[{ seat: 1, amount: 9 }, { seat: 2, amount: 2 }]]);
});

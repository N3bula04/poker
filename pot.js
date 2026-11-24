(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChiplessPots = factory();
})(globalThis, function () {
  function computePots(players) {
    const maxBet = Math.max(0, ...players.map(p => p.totalBet));
    const caps = players
      .filter(p => p.stack === 0 && p.totalBet > 0 && p.totalBet < maxBet)
      .map(p => p.totalBet);
    const levels = [...new Set(caps)].sort((a, b) => a - b);
    if (maxBet > 0) levels.push(maxBet);

    let previous = 0;
    return levels.map(level => {
      const contributions = [];
      players.forEach((p, seat) => {
        const amount = Math.min(p.totalBet, level) - previous;
        if (amount > 0) contributions.push({ seat, amount });
      });
      previous = level;
      const contrib = contributions.map(c => c.seat);
      const eligible = contrib.filter(seat => !players[seat].folded && !players[seat].out);
      const amount = contributions.reduce((sum, c) => sum + c.amount, 0);
      return { amount, contrib, eligible, contributions };
    });
  }

  function settlePots(pots) {
    const awardable = [];
    const refunds = [];
    for (const pot of pots) {
      if (pot.eligible.length === 0) {
        refunds.push(pot.contributions);
        continue;
      }

      // A live pot can include a tail above the next largest contribution.
      const contributions = pot.contributions.map(c => {
        if (!pot.eligible.includes(c.seat)) return c;
        const matched = Math.max(0, ...pot.contributions
          .filter(other => other.seat !== c.seat)
          .map(other => other.amount));
        if (c.amount <= matched) return c;
        refunds.push([{ seat: c.seat, amount: c.amount - matched }]);
        return { seat: c.seat, amount: matched };
      }).filter(c => c.amount > 0);
      const amount = contributions.reduce((sum, c) => sum + c.amount, 0);
      if (amount > 0) awardable.push({ ...pot, amount, contributions });
    }
    return { awardable, refunds };
  }

  function splitPayout(amount, winners, dealer, seatCount) {
    const share = Math.floor(amount / winners.length);
    const payouts = new Map(winners.map(seat => [seat, share]));
    const order = [];
    for (let k = 1; k <= seatCount; k++) {
      const seat = (dealer + k) % seatCount;
      if (payouts.has(seat)) order.push(seat);
    }
    const remainder = amount - share * winners.length;
    for (let r = 0; r < remainder; r++) {
      const seat = order[r % order.length];
      payouts.set(seat, payouts.get(seat) + 1);
    }
    return payouts;
  }

  return { computePots, settlePots, splitPayout };
});

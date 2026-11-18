import { legalMoves, reduceMove, square, safeSquare, HOME } from './logic.js';
function danger(g, seat, p) {
  const target = square(g, seat, p);
  if (target === null || safeSquare(target)) return 0;
  return g.players.reduce((risk, tokens, other) => other === seat ? risk : risk + tokens.filter(pos => {
    if (pos < 0 || pos >= 52) return false;
    const distance = (target - square(g, other, pos) + 52) % 52;
    return distance > 0 && distance <= 6 && pos + distance < 52;
  }).length, 0);
}
export function chooseToken(g) {
  const seat = g.turn;
  let best = null, bestScore = -Infinity;
  for (const token of legalMoves(g)) {
    const next = reduceMove(g, seat, { type: 'pick', token });
    const from = g.players[seat][token], to = next.players[seat][token];
    const score = next.last.captured * 100000 + (to === HOME ? 10000 : 0) + (from === -1 ? 1000 : 0) +
      (danger(g, seat, from) - danger(next, seat, to)) * 100 + to;
    if (score > bestScore) { best = token; bestScore = score; }
  }
  return best;
}

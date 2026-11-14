// Positions: -1 yard; 0..51 on the shared track; 52..56 private lane; 57 home.
export const HOME = 57;
export const SYMBOLS = ['●', '■', '▲', '★'];
export const DEFAULTS = { tokens: 2, threeSixes: true, captureBonus: true, autoMove: false };
export function newGame(count = 2, options = {}) {
  if (!Number.isInteger(count) || count < 2 || count > 4) throw Error('players');
  const settings = { ...DEFAULTS, ...options };
  if (![2, 4].includes(settings.tokens) || ['threeSixes', 'captureBonus', 'autoMove'].some(k => typeof settings[k] !== 'boolean')) throw Error('settings');
  return { v: 1, settings, players: Array.from({ length: count }, () => Array(settings.tokens).fill(-1)), turn: 0, phase: 'roll', die: null, sixes: 0, winner: null, last: null };
}
export function starts(g) { return g.players.length === 2 ? [0, 26] : [0, 13, 26, 39]; }
export function square(g, seat, position) { return position >= 0 && position < 52 ? (starts(g)[seat] + position) % 52 : null; }
export const safeSquare = square => [0, 8, 13, 21, 26, 34, 39, 47].includes(square);
export function occupants(g, target, except = -1) {
  return g.players.flatMap((tokens, seat) => seat === except ? [] : tokens.flatMap((p, token) => square(g, seat, p) === target ? [{ seat, token }] : []));
}
export function destination(position, die) { return position === -1 ? (die === 6 ? 0 : null) : position + die <= HOME ? position + die : null; }
export function legalMoves(g) {
  if (g.phase !== 'choose') return [];
  return g.players[g.turn].flatMap((p, token) => {
    const dest = destination(p, g.die);
    if (p === HOME || dest === null) return [];
    const target = square(g, g.turn, dest);
    const others = target === null || safeSquare(target) ? [] : occupants(g, target, g.turn);
    // Two or more of one opponent's tokens block landing, but never passage.
    if (others.some(o => others.filter(x => x.seat === o.seat).length >= 2)) return [];
    return [token];
  });
}
function pass(g) { g.turn = (g.turn + 1) % g.players.length; g.phase = 'roll'; g.sixes = 0; }
export function reduceMove(game, seat, action) {
  if (!action || !['roll', 'pick'].includes(action.type) || game.phase === 'finished' || seat !== game.turn) throw Error('illegal move');
  const g = structuredClone(game);
  if (action.type === 'roll') {
    if (g.phase !== 'roll' || !Number.isInteger(action.value) || action.value < 1 || action.value > 6) throw Error('illegal roll');
    g.die = action.value;
    g.sixes = g.die === 6 ? g.sixes + 1 : 0;
    g.last = { type: 'rolled', seat, value: g.die };
    if (g.settings.threeSixes && g.sixes === 3) {
      g.last.type = 'forfeit'; pass(g); return g;
    }
    g.phase = 'choose';
    if (!legalMoves(g).length) { g.last.type = 'noMove'; pass(g); }
    return g;
  }
  if (!legalMoves(g).includes(action.token)) throw Error('illegal token');
  const from = g.players[seat][action.token];
  const to = destination(from, g.die);
  g.players[seat][action.token] = to;
  const target = square(g, seat, to);
  const captured = target === null || safeSquare(target) ? [] : occupants(g, target, seat);
  for (const c of captured) g.players[c.seat][c.token] = -1;
  const bonus = g.die === 6 || (captured.length > 0 && g.settings.captureBonus);
  g.last = { type: 'moved', seat, token: action.token, from, to, captured: captured.length, bonus };
  g.phase = 'roll';
  if (g.players[seat].every(p => p === HOME)) { g.winner = seat; g.phase = 'finished'; }
  else if (!bonus) pass(g);
  return g;
}
export function applySkip(game) {
  if (game.phase === 'finished') throw Error('finished');
  const g = structuredClone(game);
  g.last = { type: 'skipped', seat: g.turn }; g.die = null; pass(g); return g;
}
export function ranking(g) {
  return g.players.map((tokens, seat) => ({ seat, home: tokens.filter(p => p === HOME).length }))
    .sort((a, b) => b.home - a.home || a.seat - b.seat);
}
export function validateGame(g) {
  if (!g || g.v !== 1 || !Array.isArray(g.players)) throw Error('state');
  const fresh = newGame(g.players.length, g.settings);
  if (!g.settings || Object.keys(g.settings).sort().join() !== Object.keys(fresh.settings).sort().join() ||
      !g.players.every(p => Array.isArray(p) && p.length === g.settings.tokens && p.every(x => Number.isInteger(x) && x >= -1 && x <= HOME)) ||
      !Number.isInteger(g.turn) || g.turn < 0 || g.turn >= g.players.length ||
      !['roll', 'choose', 'finished'].includes(g.phase) ||
      !(g.die === null || Number.isInteger(g.die) && g.die >= 1 && g.die <= 6) ||
      !Number.isInteger(g.sixes) || g.sixes < 0 || g.sixes > (g.settings.threeSixes ? 2 : 1000000) ||
      (g.phase === 'choose' && (g.die === null || legalMoves(g).length === 0)) ||
      (g.winner !== null && (!Number.isInteger(g.winner) || g.winner !== g.turn)) ||
      (g.phase === 'finished' ? g.winner === null || !g.players[g.winner].every(p => p === HOME) : g.winner !== null || g.players.some(p => p.every(x => x === HOME)))) throw Error('state');
  if (g.last !== null) {
    const e = g.last;
    if (!e || !['rolled','forfeit','noMove','moved','skipped'].includes(e.type) || !Number.isInteger(e.seat) || e.seat < 0 || e.seat >= g.players.length) throw Error('event');
    if (['rolled','forfeit','noMove'].includes(e.type) && (!Number.isInteger(e.value) || e.value < 1 || e.value > 6)) throw Error('event');
    if (e.type === 'moved' && (!Number.isInteger(e.token) || e.token < 0 || e.token >= g.settings.tokens ||
        !Number.isInteger(e.from) || e.from < -1 || e.from >= HOME || !Number.isInteger(e.to) || e.to < 0 || e.to > HOME ||
        !Number.isInteger(e.captured) || e.captured < 0 || e.captured > 12 || typeof e.bonus !== 'boolean')) throw Error('event');
  }
  return structuredClone(g);
}
export function rollDie(cryptoSource = globalThis.crypto) {
  const buffer = new Uint32Array(1);
  do { cryptoSource.getRandomValues(buffer); } while (buffer[0] >= 4294967292);
  return buffer[0] % 6 + 1;
}

// Pure rules and board geometry. Zero means waiting just off the board.
export const BOARDS = Object.freeze({
  classic: Object.freeze({ end: 100, ladders: Object.freeze({ 2: 23, 8: 30, 20: 41, 28: 50, 36: 55, 51: 72, 63: 81, 71: 92 }), snakes: Object.freeze({ 17: 5, 32: 12, 48: 26, 60: 39, 69: 49, 79: 58, 88: 67, 97: 76 }) }),
  // Each short-board connection has its own column and spans at least two rows.
  short: Object.freeze({ end: 50, ladders: Object.freeze({ 2: 22, 4: 37, 7: 27, 12: 49, 16: 45 }), snakes: Object.freeze({ 31: 10, 33: 13, 40: 20, 43: 18, 46: 15 }) }),
});
export function coordinates(square, end = 100) {
  if (![50, 100].includes(end) || !Number.isInteger(square) || square < 1 || square > end) throw Error('square');
  const row = Math.floor((square - 1) / 10), offset = (square - 1) % 10;
  return { x: row % 2 ? 9 - offset : offset, y: end / 10 - 1 - row };
}
export function squareAt(x, y, end = 100) {
  if (![50, 100].includes(end) || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 9 || y < 0 || y >= end / 10) throw Error('coordinates');
  const row = end / 10 - 1 - y;
  return row * 10 + (row % 2 ? 9 - x : x) + 1;
}
export function resolve(square, board) {
  const seen = new Set(), jumps = [];
  while (board.ladders[square] !== undefined || board.snakes[square] !== undefined) {
    if (seen.has(square)) throw Error('cycle');
    seen.add(square);
    const to = board.ladders[square] ?? board.snakes[square];
    if (!Number.isInteger(to) || to < 1 || to > board.end) throw Error('destination');
    jumps.push({ from: square, to, kind: to > square ? 'ladder' : 'snake' });
    square = to;
  }
  return { square, jumps };
}
export function createGame({ board = 'classic', exact = true, again = false, players = ['human', 'computer'] } = {}) {
  if (!BOARDS[board] || typeof exact !== 'boolean' || typeof again !== 'boolean' || !Array.isArray(players) || players.length < 2 || players.length > 4 || players.some(p => !['human', 'computer'].includes(p))) throw Error('settings');
  return { v: 1, board, exact, again, players: [...players], positions: players.map(() => 0), turn: 0, turns: 0, status: 'playing', winner: null, last: null };
}
export function validateGame(value) {
  if (!value || value.v !== 1) throw Error('state');
  const initial = createGame(value), end = BOARDS[initial.board].end, n = initial.players.length;
  if (!Array.isArray(value.positions) || value.positions.length !== n || value.positions.some(p => !Number.isInteger(p) || p < 0 || p > end) || !Number.isInteger(value.turn) || value.turn < 0 || value.turn >= n || !Number.isSafeInteger(value.turns) || value.turns < 0) throw Error('state');
  if (!['playing', 'finished'].includes(value.status) || (value.status === 'playing' ? value.winner !== null || value.positions.includes(end) : !Number.isInteger(value.winner) || value.winner < 0 || value.winner >= n || value.positions[value.winner] !== end || value.positions.filter(p => p === end).length !== 1 || value.turn !== value.winner)) throw Error('state');
  let last = null;
  if (value.last !== null) {
    const l = value.last;
    if (!l || !Number.isInteger(l.seat) || l.seat < 0 || l.seat >= n || !Number.isInteger(l.roll) || l.roll < 1 || l.roll > 6 || !Number.isInteger(l.from) || l.from < 0 || l.from >= end) throw Error('state');
    const route = travel(l.from, l.roll, BOARDS[value.board], value.exact);
    if (route.to !== value.positions[l.seat]) throw Error('state');
    last = { seat: l.seat, roll: l.roll, from: l.from, ...route };
  }
  return { ...initial, positions: [...value.positions], turn: value.turn, turns: value.turns, status: value.status, winner: value.winner, last };
}
export function travel(from, roll, board, exact) {
  let square = from, direction = 1;
  const steps = [];
  for (let i = 0; i < roll; i++) {
    if (square === board.end) { if (!exact) break; direction = -1; }
    square += direction;
    steps.push(square);
  }
  const result = resolve(square, board);
  return { to: result.square, steps, jumps: result.jumps };
}
export function reduceMove(game, seat, move) {
  const g = validateGame(game);
  if (g.status !== 'playing' || seat !== g.turn || !move || Object.keys(move).length !== 1 || !Number.isInteger(move.roll) || move.roll < 1 || move.roll > 6) throw Error('move');
  const from = g.positions[seat], route = travel(from, move.roll, BOARDS[g.board], g.exact);
  const positions = [...g.positions]; positions[seat] = route.to;
  const won = route.to === BOARDS[g.board].end;
  return { ...g, positions, turns: g.turns + 1, turn: won || (move.roll === 6 && g.again) ? seat : (seat + 1) % g.players.length, status: won ? 'finished' : 'playing', winner: won ? seat : null, last: { seat, roll: move.roll, from, ...route } };
}
export function skipTurn(game) {
  const g = validateGame(game);
  if (g.status !== 'playing') throw Error('finished');
  return { ...g, turn: (g.turn + 1) % g.players.length };
}
export function resizeInitial(game, count) {
  const g = validateGame(game);
  if (g.turns || g.positions.some(Boolean) || count > g.players.length || count < 2) throw Error('seats');
  return createGame({ ...g, players: g.players.slice(0, count) });
}

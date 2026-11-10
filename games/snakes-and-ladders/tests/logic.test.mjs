import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARDS, coordinates, squareAt, resolve, travel, createGame, validateGame, reduceMove, skipTurn, resizeInitial } from '../src/logic.js';

test('boustrophedon corners and row changes', () => {
  assert.deepEqual(coordinates(1), { x: 0, y: 9 });
  assert.deepEqual(coordinates(10), { x: 9, y: 9 });
  assert.deepEqual(coordinates(11), { x: 9, y: 8 });
  assert.deepEqual(coordinates(20), { x: 0, y: 8 });
  assert.deepEqual(coordinates(100), { x: 0, y: 0 });
  assert.deepEqual(coordinates(50, 50), { x: 9, y: 0 });
});
test('every square maps back uniquely on both boards', () => {
  for (const end of [50, 100]) {
    const seen = new Set();
    for (let n = 1; n <= end; n++) { const { x, y } = coordinates(n, end); assert.equal(squareAt(x, y, end), n); seen.add(`${x},${y}`); }
    assert.equal(seen.size, end);
  }
});
test('geometry rejects off-board and noninteger coordinates', () => {
  for (const value of [0, -1, 101, 1.5, NaN]) assert.throws(() => coordinates(value));
  for (const pair of [[-1, 0], [10, 0], [0, 10], [1.1, 0]]) assert.throws(() => squareAt(...pair));
  assert.throws(() => coordinates(1, 60));
});
test('layouts have valid, directional, disjoint, acyclic connections', () => {
  assert.equal(Object.keys(BOARDS.classic.ladders).length, 8);
  assert.equal(Object.keys(BOARDS.classic.snakes).length, 8);
  for (const board of Object.values(BOARDS)) {
    for (const [from, to] of Object.entries(board.ladders)) { assert.ok(+from < to && to < board.end); assert.equal(board.snakes[from], undefined); }
    for (const [from, to] of Object.entries(board.snakes)) assert.ok(+from > to && to > 0);
    for (let n = 1; n <= board.end; n++) assert.ok(resolve(n, board).square >= 1);
    assert.equal(resolve(board.end, board).square, board.end);
  }
});
test('ladder, snake and plain square resolution', () => {
  assert.deepEqual(resolve(2, BOARDS.classic), { square: 23, jumps: [{ from: 2, to: 23, kind: 'ladder' }] });
  assert.equal(resolve(17, BOARDS.classic).square, 5);
  assert.deepEqual(resolve(3, BOARDS.classic), { square: 3, jumps: [] });
});
test('short-board connections span full rows in separate columns with distinct endpoints', () => {
  const board = BOARDS.short, columns = new Set(), endpoints = new Set();
  assert.equal(Object.keys(board.ladders).length, 5);
  assert.equal(Object.keys(board.snakes).length, 5);
  for (const [from, to] of Object.entries({ ...board.ladders, ...board.snakes })) {
    const a = coordinates(+from, board.end), b = coordinates(to, board.end);
    assert.ok(Math.abs(a.y - b.y) >= 2, `${from} → ${to} must span at least two rows`);
    assert.equal(a.x, b.x);
    assert.ok(!columns.has(a.x), `${from} → ${to} needs its own column`);
    columns.add(a.x);
    for (const n of [+from, to]) { assert.ok(!endpoints.has(n)); endpoints.add(n); }
    assert.equal(resolve(+from, board).square, to);
  }
  assert.equal(resolve(2, board).square, 22);
  assert.equal(resolve(43, board).square, 18);
});
test('connection chains continue through ladders and snakes', () => {
  const result = resolve(2, { end: 100, ladders: { 2: 20, 7: 30 }, snakes: { 20: 7 } });
  assert.equal(result.square, 30); assert.deepEqual(result.jumps.map(j => j.kind), ['ladder', 'snake', 'ladder']);
});
test('cycles and invalid connection destinations are rejected', () => {
  assert.throws(() => resolve(2, { end: 50, ladders: { 2: 20 }, snakes: { 20: 2 } }));
  assert.throws(() => resolve(2, { end: 50, ladders: { 2: 60 }, snakes: {} }));
});
test('all players start off-board; first roll needs no six', () => {
  const game = createGame();
  const next = reduceMove(game, 0, { roll: 3 });
  assert.deepEqual(game.positions, [0, 0]); assert.equal(next.positions[0], 3); assert.equal(next.turn, 1);
});
test('movement includes every square before a ladder', () => {
  const next = reduceMove(createGame(), 0, { roll: 2 });
  assert.deepEqual(next.last.steps, [1, 2]); assert.equal(next.last.to, 23); assert.equal(next.last.jumps[0].kind, 'ladder');
});
test('crossing a snake or ladder has no effect without landing', () => {
  const game = { ...createGame(), positions: [14, 0] };
  assert.equal(reduceMove(game, 0, { roll: 4 }).positions[0], 18);
});
test('exact finish bounces step by step, without winning on passing 100', () => {
  const game = { ...createGame(), positions: [98, 0] };
  const next = reduceMove(game, 0, { roll: 4 });
  assert.deepEqual(next.last.steps, [99, 100, 99, 98]); assert.equal(next.positions[0], 98); assert.equal(next.winner, null);
});
test('a bounce can land on a snake head', () => {
  const next = reduceMove({ ...createGame(), positions: [99, 0] }, 0, { roll: 4 });
  assert.equal(next.last.steps.at(-1), 97); assert.equal(next.positions[0], 76);
});
test('short board also bounces; non-exact finish clamps at the goal', () => {
  assert.deepEqual(travel(49, 3, BOARDS.short, true).steps, [50, 49, 48]);
  const next = reduceMove({ ...createGame({ board: 'short', exact: false }), positions: [49, 0] }, 0, { roll: 6 });
  assert.deepEqual(next.last.steps, [50]); assert.equal(next.winner, 0); assert.equal(next.status, 'finished');
});
test('landing exactly on the goal wins and blocks further moves', () => {
  const next = reduceMove({ ...createGame(), positions: [94, 0] }, 0, { roll: 6 });
  assert.equal(next.winner, 0); assert.equal(next.turn, 0); assert.equal(next.status, 'finished');
  assert.throws(() => reduceMove(next, 0, { roll: 1 })); assert.throws(() => skipTurn(next));
});
test('roll six switches players by default; optional six keeps the turn', () => {
  assert.equal(reduceMove(createGame(), 0, { roll: 6 }).turn, 1);
  const next = reduceMove(createGame({ again: true }), 0, { roll: 6 });
  assert.equal(next.turn, 0); assert.equal(reduceMove(next, 0, { roll: 3 }).turn, 1);
});
test('win takes priority over extra-turn setting', () => {
  const next = reduceMove({ ...createGame({ again: true }), positions: [94, 0] }, 0, { roll: 6 });
  assert.equal(next.status, 'finished'); assert.equal(next.turn, 0);
});
test('four seats wrap around; skipping changes no position or roll count', () => {
  let game = createGame({ players: Array(4).fill('human') });
  for (let i = 0; i < 4; i++) game = reduceMove(game, i, { roll: 1 });
  assert.equal(game.turn, 0); assert.equal(game.turns, 4);
  const skipped = skipTurn(game); assert.deepEqual(skipped.positions, game.positions); assert.equal(skipped.turns, 4); assert.equal(skipped.turn, 1);
});
test('illegal rolls, wrong seats and extra move fields are rejected', () => {
  for (const roll of [0, 7, 2.5, '3', NaN, null]) assert.throws(() => reduceMove(createGame(), 0, { roll }));
  assert.throws(() => reduceMove(createGame(), 1, { roll: 1 }));
  assert.throws(() => reduceMove(createGame(), 0, { roll: 1, winner: 0 }));
});
test('invalid saves/settings are rejected and valid saves are canonicalized', () => {
  for (const settings of [{ players: ['human'] }, { players: Array(5).fill('human') }, { players: ['robot', 'human'] }, { exact: 1 }, { board: 'other' }]) assert.throws(() => createGame(settings));
  const game = createGame();
  for (const patch of [{ v: 2 }, { turn: 3 }, { positions: [101, 0] }, { positions: [100, 0] }, { turns: -1 }, { status: 'finished', winner: 0 }, { last: { seat: 5 } }]) assert.throws(() => validateGame({ ...game, ...patch }));
  assert.deepEqual(validateGame(JSON.parse(JSON.stringify(reduceMove(game, 0, { roll: 2 })))), reduceMove(game, 0, { roll: 2 }));
});
test('start can remove unoccupied seats only before play', () => {
  const game = createGame({ players: Array(4).fill('human') });
  assert.equal(resizeInitial(game, 2).players.length, 2);
  assert.throws(() => resizeInitial(reduceMove(game, 0, { roll: 1 }), 2));
  assert.throws(() => resizeInitial(game, 1));
});

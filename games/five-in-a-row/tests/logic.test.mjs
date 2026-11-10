import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyMove, applySkip, validateGame, replay, undo, winningLine, lastMove } from '../src/logic.js';

const play = (g, i) => applyMove(g, g.turn, { index: i });
function withBlack(points, size = 9) {
  let g = newGame(size);
  const fillers = [72, 74, 76, 78, 80];
  points.forEach((i, n) => {
    g = play(g, i);
    if (n < points.length - 1) g = play(g, fillers[n]);
  });
  return g;
}
for (const [name, points] of Object.entries({
  horizontal: [0, 1, 2, 3, 4], vertical: [0, 9, 18, 27, 36], diagonal: [0, 10, 20, 30, 40],
  antiDiagonal: [8, 16, 24, 32, 40], rightEdge: [8, 17, 26, 35, 44],
  bottomEdge: [76, 77, 78, 79, 80], sixWithBridge: [0, 1, 2, 4, 5, 3],
})) {
  test(`freestyle win: ${name}`, () => {
    let g;
    if (name === 'bottomEdge') {
      g = newGame(9);
      points.forEach((i, n) => { g = play(g, i); if (n < 4) g = play(g, n * 2); });
    } else if (name === 'sixWithBridge') {
      g = newGame(9);
      points.forEach((i, n) => { g = play(g, i); if (n < 5) g = play(g, 72 + n * 2); });
    } else g = withBlack(points);
    assert.equal(g.winner, 0);
    assert.equal(g.line.length, points.length);
    assert.deepEqual(new Set(g.line), new Set(points));
    assert.deepEqual(validateGame(g), g);
  });
}
test('white wins and the next move is rejected', () => {
  let g = newGame(9);
  for (let n = 0; n < 5; n++) { g = play(g, 72 + n * 2); g = play(g, n); }
  assert.equal(g.winner, 1);
  assert.throws(() => play(g, 20), /game_over/);
  assert.throws(() => applySkip(g), /invalid_skip/);
});
test('full board without five is a draw', () => {
  let g = newGame(9);
  const points = [[], []];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) points[(Math.floor(c / 2) + r) % 2].push(r * 9 + c);
  for (let n = 0; n < 81; n++) g = play(g, points[n % 2].shift());
  assert.equal(g.winner, 'draw');
  assert.deepEqual(g.line, []);
  assert.deepEqual(validateGame(g), g);
});
test('illegal placements, turns and unsupported sizes are rejected without mutation', () => {
  const g = newGame();
  assert.throws(() => newGame(10), /invalid_size/);
  for (const index of [-1, 225, 1.5, '1', NaN, undefined]) assert.throws(() => play(g, index), /invalid_move/);
  assert.throws(() => applyMove(g, 1, { index: 0 }), /not_your_turn/);
  const next = play(g, 0);
  assert.throws(() => play(next, 0), /occupied/);
  assert.equal(g.board, '0'.repeat(225));
  assert.equal(g.moves.length, 0);
});
test('row edges cannot wrap into a false five', () => {
  const board = [...'0'.repeat(81)];
  for (const i of [6, 7, 8, 9, 10]) board[i] = '1';
  assert.deepEqual(winningLine(board.join(''), 9, 8), []);
});
test('snapshot validation replays history and rejects edits or post-win events', () => {
  const g = play(newGame(9), 10);
  for (const change of [{ board: '0'.repeat(81) }, { turn: 0 }, { winner: 1 }, { line: [10] },
    { revision: -1 }, { revision: 1.5 }, { moves: [[10, 1]] }, { moves: [[10, 0, 7]] }, { moves: 'bad' }]) {
    assert.throws(() => validateGame({ ...g, ...change }));
  }
  const won = withBlack([0, 1, 2, 3, 4]);
  assert.throws(() => replay(9, [...won.moves, [15, 1]]), /game_over/);
});
test('skips are replayable, preserve stones and allow the returning seat to play', () => {
  let g = play(newGame(9), 0);
  g = applySkip(g);
  assert.equal(g.turn, 0);
  assert.equal(lastMove(g), 0);
  g = play(g, 1);
  g = play(g, 9);
  assert.deepEqual(validateGame(g), g);
  assert.throws(() => applySkip(g, 1 - g.turn), /invalid_skip/);
});
test('undo uses the right number of turns in each mode', () => {
  const a = play(newGame(9), 0), b = play(a, 9), c = play(b, 1);
  assert.equal(undo(c, 'local').moves.length, 2);
  assert.equal(undo(b, 'computer', 0).moves.length, 0);
  assert.equal(undo(c, 'computer', 0).moves.length, 2);
  assert.equal(undo(a, 'computer', 1), a);
  assert.equal(undo(c, 'computer', 1).moves.length, 1);
  assert.equal(undo(c, 'room'), c);
  assert.equal(undo(newGame(), 'local').moves.length, 0);
  assert.equal(undo(withBlack([0, 1, 2, 3, 4]), 'local').winner, null);
});
test('150 random complete games on all sizes remain valid and terminate', () => {
  let seed = 71;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let n = 0; n < 150; n++) {
    let g = newGame([9, 13, 15][n % 3]);
    while (g.winner === null) {
      const empty = [...g.board].flatMap((v, i) => v === '0' ? [i] : []);
      g = play(g, empty[Math.floor(random() * empty.length)]);
    }
    assert.deepEqual(validateGame(g), g);
    assert.ok(g.moves.length <= g.size ** 2);
  }
});

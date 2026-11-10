import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyMove } from '../src/logic.js';
import { chooseMove, threat, candidates } from '../src/ai.js';

function position(black, white, turn = 0) {
  const g = newGame(15), board = [...g.board];
  black.forEach((i) => { board[i] = '1'; }); white.forEach((i) => { board[i] = '2'; });
  return { ...g, board: board.join(''), turn };
}
for (const difficulty of ['easy', 'normal', 'hard']) {
  for (const seat of [0, 1]) test(`${difficulty} takes an immediate ${seat === 0 ? 'black' : 'white'} win`, () => {
    const g = position(seat === 0 ? [105, 106, 107, 108] : [0, 2, 4], seat === 1 ? [105, 106, 107, 108] : [0, 2, 4], seat);
    assert.equal(chooseMove(g, difficulty, () => 0.9), 109);
  });
  test(`${difficulty} blocks an open four`, () => {
    const g = position([0, 2, 4], [109, 110, 111, 112]);
    assert.ok([108, 113].includes(chooseMove(g, difficulty, () => 0.9)));
  });
  test(`${difficulty} blocks a broken four`, () => {
    const g = position([0, 2, 4], [109, 110, 112, 113]);
    assert.equal(chooseMove(g, difficulty), 111);
  });
}
test('a win takes precedence over defending', () => {
  assert.equal(chooseMove(position([105, 106, 107, 108], [30, 31, 32, 33]), 'hard'), 109);
});
test('hard makes an open four rather than a quiet extension', () => {
  const g = position([109, 110, 111], [30, 32, 34]);
  assert.ok([108, 112].includes(chooseMove(g, 'hard')));
});
test('hard blocks an opponent open-four setup', () => {
  const g = position([30, 32, 34], [109, 110, 111]);
  assert.ok([108, 112].includes(chooseMove(g, 'hard')));
});
test('hard finds a double-three intersection', () => {
  const g = position([111, 113, 97, 127], [0, 20, 40, 60]);
  assert.equal(chooseMove(g, 'hard'), 112);
  assert.ok(threat(g.board, 15, 112, 0) >= 8e5);
});
test('normal can make an occasional lower-ranked move; easy is varied', () => {
  const g = position([112], [113]);
  assert.notEqual(chooseMove(g, 'normal', () => 0.2), chooseMove(g, 'normal', () => 0.99));
  assert.notEqual(chooseMove(g, 'easy', () => 0), chooseMove(g, 'easy', () => 0.99));
});
test('opening is central, moves are legal near stones, and finished games have no move', () => {
  assert.equal(chooseMove(newGame()), 112);
  assert.equal(chooseMove(newGame(9)), 40);
  assert.deepEqual(candidates(newGame(13)), [84]);
  assert.equal(chooseMove({ ...newGame(), winner: 'draw' }), null);
  let g = newGame();
  for (let n = 0; n < 70 && g.winner === null; n++) {
    const i = chooseMove(g, ['easy', 'normal', 'hard'][n % 3], () => 0.37);
    assert.equal(g.board[i], '0'); assert.ok(candidates(g).includes(i));
    g = applyMove(g, g.turn, { index: i });
  }
});
test('hard search stays within the 300 ms decision budget on representative boards', (context) => {
  const positions = [newGame(), position([112], [113]), position([32, 64, 96, 128, 160], [49, 81, 114, 146, 178])];
  let worst = 0;
  for (let n = 0; n < 20; n++) for (const g of positions) {
    const start = performance.now(); chooseMove(g, 'hard'); worst = Math.max(worst, performance.now() - start);
  }
  context.diagnostic(`Worst hard decision: ${worst.toFixed(2)} ms on this machine (not a phone benchmark).`);
  assert.ok(worst < 300);
});

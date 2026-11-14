import test from 'node:test';
import assert from 'node:assert/strict';
import { rollDie, computerMove, computerDelay } from '../src/ai.js';
import { createGame, reduceMove } from '../src/logic.js';
export function seeded(seed = 12345) { return { getRandomValues(a) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; a[0] = seed; return a; } }; }
test('crypto die covers all faces and rejects the biased tail', () => {
  const words = [4294967295, 4294967292, 5], random = { getRandomValues(a) { a[0] = words.shift(); return a; } };
  assert.equal(rollDie(random), 6); assert.equal(words.length, 0);
  for (let i = 0; i < 6; i++) assert.equal(rollDie({ getRandomValues(a) { a[0] = i; } }), i + 1);
  assert.throws(() => rollDie({}), /random_unavailable/);
});
test('computer move is only a roll, available only on computer turns', () => {
  assert.throws(() => computerMove(createGame(), seeded()));
  assert.deepEqual(Object.keys(computerMove(createGame({ players: ['computer', 'computer'] }), seeded())), ['roll']);
  assert.ok(computerDelay(true) < computerDelay(false));
});
test('400 four-computer games finish across both boards and all variants', () => {
  let maximum = 0;
  for (let i = 0; i < 400; i++) {
    let game = createGame({ players: Array(4).fill('computer'), board: i % 2 ? 'short' : 'classic', exact: !!(i & 2), again: !!(i & 4) });
    const random = seeded(i + 1);
    while (game.status === 'playing' && game.turns < 3000) game = reduceMove(game, game.turn, computerMove(game, random));
    assert.equal(game.status, 'finished', `seed ${i}`); maximum = Math.max(maximum, game.turns);
  }
  assert.ok(maximum < 3000);
});
test('computer decisions have no search and comfortably meet 300 ms budget', () => {
  const game = createGame({ players: ['computer', 'computer'] }); const random = seeded(), start = performance.now();
  for (let i = 0; i < 10000; i++) computerMove(game, random);
  assert.ok(performance.now() - start < 300);
});

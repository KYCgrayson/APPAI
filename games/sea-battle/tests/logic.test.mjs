import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/logic.js';
import { seeded } from './helpers.mjs';

const ready = (options = {}, seed = 1) => {
  const game = L.createGame(options), rng = seeded(seed);
  game.fleets = [L.randomFleet(game.size, game.touch, rng), L.randomFleet(game.size, game.touch, rng)];
  return L.startGame(game);
};
test('classic and small fleets have the required sizes and totals', () => {
  assert.deepEqual(L.fleetSizes(10), [5, 4, 3, 3, 2]);
  assert.deepEqual(L.fleetSizes(8), [4, 3, 3, 2]);
  assert.equal(L.fleetSizes(10).reduce((a, b) => a + b), 17);
  assert.equal(L.fleetSizes(8).reduce((a, b) => a + b), 12);
});
test('coordinates include the last row and column on each board', () => {
  assert.equal(L.coordinate(0, 10), 'A1');
  assert.equal(L.coordinate(99, 10), 'J10');
  assert.equal(L.coordinate(63, 8), 'H8');
});
test('placement creates straight horizontal and vertical cells', () => {
  assert.deepEqual(L.shipCells(10, 3, 12), [12, 13, 14]);
  assert.deepEqual(L.shipCells(10, 3, 12, true), [12, 22, 32]);
});
test('placement rejects edges, row wrapping, invalid cells and lengths', () => {
  for (const [length, start, vertical] of [[3, 9, false], [4, 70, true], [2, -1], [2, 100], [2, 1.5], [1, 0], [6, 0]]) {
    assert.equal(L.placementError(10, [], length, start, vertical), 'bounds');
  }
  assert.throws(() => L.createGame({ size: 9 }));
});
test('overlap is forbidden even when touching is allowed', () => {
  assert.equal(L.placementError(10, [[11, 12]], 3, 12, true, true), 'overlap');
});
test('sideways and diagonal touching are rejected by default', () => {
  for (const start of [0, 13, 20, 22, 3]) {
    assert.equal(L.placementError(10, [[11, 12]], 2, start), 'touching');
  }
  assert.equal(L.placementError(10, [[11, 12]], 2, 30), null);
});
test('touch option permits adjacent ships but not invalid bounds', () => {
  assert.equal(L.placementError(10, [[11, 12]], 2, 22, false, true), null);
  assert.equal(L.placementError(10, [[11, 12]], 2, 99, false, true), 'bounds');
});
for (const size of [8, 10]) for (const touch of [false, true]) {
  test(`random placement: 1000 valid fleets on ${size} × ${size}, touch=${touch}`, () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const fleet = L.randomFleet(size, touch, seeded(seed));
      assert.ok(L.validFleet(size, fleet, touch), `seed ${seed}`);
      assert.equal(new Set(fleet.flat()).size, L.fleetSizes(size).reduce((a, b) => a + b));
    }
  });
}
test('random placement is deterministic with an injected random source', () => {
  assert.deepEqual(L.randomFleet(10, false, seeded(7)), L.randomFleet(10, false, seeded(7)));
});
test('fleet validation rejects bent, repeated, missing, extra and wrapped ships', () => {
  const fleet = L.randomFleet(10, false, seeded(4));
  const bad = structuredClone(fleet);
  bad[0][1] = bad[0][0];
  assert.equal(L.validFleet(10, bad), false);
  assert.equal(L.validFleet(10, fleet.slice(1)), false);
  assert.equal(L.validFleet(10, [...fleet, [98, 99]]), false);
  assert.equal(L.validFleet(10, [null]), false);
  assert.equal(L.validFleet(10, [[8, 9, 10, 11, 12], ...fleet.slice(1)]), false);
  assert.equal(L.validFleet(10, [[0, 1, 2, 12, 22], ...fleet.slice(1)]), false);
});
test('cannot start before both fleets are valid', () => {
  assert.throws(() => L.startGame(L.createGame()), /fleet/);
});
test('shots distinguish miss, hit and sunk, revealing size only when sunk', () => {
  const fleet = [[0, 1], [20, 21, 22]], shots = [];
  const miss = L.resolveShot(10, fleet, shots, 99);
  assert.equal(miss.result, 'miss');
  assert.equal(miss.size, null);
  assert.deepEqual(miss.sunkCells, []);
  shots.push(miss, L.resolveShot(10, fleet, shots, 0));
  assert.equal(shots[1].result, 'hit');
  assert.equal(shots[1].size, null);
  const sunk = L.resolveShot(10, fleet, shots, 1);
  assert.equal(sunk.result, 'sunk');
  assert.equal(sunk.size, 2);
  assert.deepEqual(sunk.sunkCells, [0, 1]);
  assert.equal(sunk.win, false);
});
test('winning shot sinks the last ship', () => {
  const shots = [0, 20, 21, 22].map(cell => ({ cell, result: 'hit' }));
  const shot = L.resolveShot(10, [[0, 1], [20, 21, 22]], shots, 1);
  assert.equal(shot.result, 'sunk');
  assert.equal(shot.win, true);
});
test('repeat shots and out-of-range shots are rejected', () => {
  assert.throws(() => L.resolveShot(10, [[0, 1]], [{ cell: 0, result: 'hit' }], 0), /repeat/);
  for (const cell of [-1, 100, 1.5, NaN, '3']) assert.throws(() => L.resolveShot(10, [[0, 1]], [], cell), /bounds/);
});
test('one shot per turn is default, including hits, without mutating input', () => {
  const game = ready(), before = structuredClone(game);
  const next = L.fire(game, 0, game.fleets[1][0][0]);
  assert.equal(next.turn, 1);
  assert.equal(next.shots[0][0].result, 'hit');
  assert.deepEqual(game, before);
  assert.throws(() => L.fire(next, 0, 99), /turn/);
});
test('extra-shot variant keeps hits and sunk shots, and passes on a miss', () => {
  let game = ready({ again: true });
  for (const cell of game.fleets[1][0]) game = L.fire(game, 0, cell);
  assert.equal(game.shots[0].at(-1).result, 'sunk');
  assert.equal(game.turn, 0);
  const water = Array.from({ length: 100 }, (_, c) => c).find(c => !game.fleets[1].flat().includes(c));
  assert.equal(L.fire(game, 0, water).turn, 1);
});
test('AI knowledge contains only public shot data and generic ship lengths', () => {
  const game = ready(), data = L.shotKnowledge(game, 0);
  assert.deepEqual(Object.keys(data).sort(), ['lengths', 'shots', 'size', 'touch']);
  assert.equal(JSON.stringify(data).includes('fleets'), false);
});
test('100 complete seeded games obey alternation, variants and terminal state', () => {
  for (let seed = 1; seed <= 100; seed++) {
    let game = ready({ size: seed % 2 ? 8 : 10, touch: seed % 3 === 0, again: seed % 4 === 0 }, seed);
    let count = 0;
    while (game.winner === null) {
      const p = game.turn;
      const cell = Array.from({ length: game.size ** 2 }, (_, c) => c).find(c => !game.shots[p].some(s => s.cell === c));
      game = L.fire(game, p, cell);
      assert.ok(++count <= game.size ** 2 * 2);
    }
    assert.equal(game.status, 'finished');
    assert.equal(game.shots[game.winner].filter(s => s.result !== 'miss').length, L.fleetSizes(game.size).reduce((a, b) => a + b));
    assert.throws(() => L.fire(game, game.turn, 0), /finished/);
  }
});

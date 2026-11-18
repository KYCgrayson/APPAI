import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseShot } from '../src/ai.js';
import { randomFleet, fleetSizes, resolveShot } from '../src/logic.js';
import { seeded } from './helpers.mjs';

for (const level of ['easy', 'normal', 'hard']) {
  test(`${level}: never repeats, stays in bounds, finishes games with either touching rule`, () => {
    for (const size of [8, 10]) for (const touch of [false, true]) for (let seed = 1; seed <= 10; seed++) {
      const rng = seeded(seed), fleet = randomFleet(size, touch, rng), shots = [];
      while (!shots.at(-1)?.win) {
        const cell = chooseShot({ size, touch, shots, lengths: fleetSizes(size) }, level, rng);
        assert.ok(Number.isInteger(cell) && cell >= 0 && cell < size ** 2);
        assert.ok(!shots.some(s => s.cell === cell));
        shots.push(resolveShot(size, fleet, shots, cell));
        assert.ok(shots.length <= size ** 2);
      }
    }
  });
}
test('normal follows an unresolved hit with an orthogonal neighbor', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const cell = chooseShot({ size: 10, touch: false, lengths: fleetSizes(10), shots: [{ cell: 44, result: 'hit', sunkCells: [] }] }, 'normal', seeded(seed));
    assert.ok([34, 43, 45, 54].includes(cell));
  }
});
test('normal stops following sunk ships', () => {
  const data = { size: 8, touch: false, lengths: fleetSizes(8), shots: [
    { cell: 0, result: 'hit', sunkCells: [] }, { cell: 1, result: 'sunk', size: 2, sunkCells: [0, 1] },
  ] };
  assert.equal(chooseShot(data, 'normal', () => .99), 63);
});
test('hard extends a line of hits and avoids sunk-ship borders', () => {
  const cell = chooseShot({ size: 10, touch: false, lengths: fleetSizes(10), shots: [
    { cell: 44, result: 'hit', sunkCells: [] }, { cell: 45, result: 'hit', sunkCells: [] },
  ] }, 'hard', seeded(1));
  assert.ok([43, 46].includes(cell));
  const shots = [{ cell: 0, result: 'hit', sunkCells: [] }, { cell: 1, result: 'sunk', size: 2, sunkCells: [0, 1] }];
  for (let seed = 1; seed <= 20; seed++) assert.ok(![2, 10, 11, 12].includes(chooseShot({ size: 10, touch: false, shots, lengths: fleetSizes(10) }, 'hard', seeded(seed))));
});
test('all levels return null when every coordinate has been tried', () => {
  for (const level of ['easy', 'normal', 'hard']) assert.equal(chooseShot({ size: 8, shots: Array.from({ length: 64 }, (_, cell) => ({ cell, result: 'miss', sunkCells: [] })), lengths: [] }, level), null);
});
test('hard beats easy over 200 paired seeded classic games', t => {
  const totals = { easy: 0, normal: 0, hard: 0 };
  let maxMs = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const fleet = randomFleet(10, false, seeded(seed));
    for (const level of Object.keys(totals)) {
      const rng = seeded(seed + 1000), shots = [];
      while (!shots.at(-1)?.win) {
        const start = performance.now();
        const cell = chooseShot({ size: 10, touch: false, lengths: fleetSizes(10), shots }, level, rng);
        maxMs = Math.max(maxMs, performance.now() - start);
        shots.push(resolveShot(10, fleet, shots, cell));
      }
      totals[level] += shots.length;
    }
  }
  assert.ok(totals.hard < totals.easy);
  // A generous local regression bound; real phone timing is a manual verification item.
  assert.ok(maxMs < 300, `slowest AI choice: ${maxMs}ms`);
  t.diagnostic(`200 games: easy=${totals.easy / 200}, normal=${totals.normal / 200}, hard=${totals.hard / 200} shots; slowest choice=${maxMs.toFixed(2)}ms`);
});

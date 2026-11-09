import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  score,
  isValidCode,
  createGame,
  applyCommit,
  applyGuess,
  applyReply,
  winner,
  candidates,
  aiGuess,
  allCodes,
} from '../src/logic/game.ts';
const ready = (first: 0 | 1 = 0) =>
  applyCommit(applyCommit(createGame({ id: 'test', first }), 0, 'a'.repeat(64)), 1, 'b'.repeat(64));
const turn = (s: any, g: string, r: string) =>
  applyReply(applyGuess(s, s.turn, g), (1 - s.turn) as 0 | 1, r);
test('score: zero, all B, all A, leading zero and four digits', () => {
  assert.deepEqual(score('012', '345'), { a: 0, b: 0 });
  assert.deepEqual(score('427', '724'), { a: 1, b: 2 });
  assert.deepEqual(score('012', '120'), { a: 0, b: 3 });
  assert.deepEqual(score('012', '012'), { a: 3, b: 0 });
  assert.deepEqual(score('0123', '3210'), { a: 0, b: 4 });
  assert.deepEqual(score('0123', '0123'), { a: 4, b: 0 });
});
test('distinct digit validation', () => {
  for (const c of ['012', '987', '709']) assert.ok(isValidCode(c, 3));
  for (const c of ['112', '12', '1234', 'abc', ' 12', '1.2'])
    assert.equal(isValidCode(c, 3), false);
  assert.equal(isValidCode('0123', 4), true);
  assert.equal(isValidCode('12345', 5), false);
});
test('reducer alternates and preserves previous state', () => {
  const s = ready(),
    before = JSON.stringify(s),
    g = applyGuess(s, 0, '012');
  assert.equal(g.turn, 1);
  assert.equal(JSON.stringify(s), before);
  assert.throws(() => applyGuess(g, 0, '345'));
  assert.throws(() => applyGuess(g, 1, '345'));
  const r = applyReply(g, 1, '0A1B');
  assert.equal(r.turn, 1);
  assert.equal(g.history[0][0].r, undefined);
  assert.equal(applyGuess(r, 1, '345').turn, 0);
});
test('fair ending: first hit gives equal final guess; draw', () => {
  let s = turn(ready(), '012', '3A0B');
  assert.equal(winner(s), null);
  s = turn(s, '345', '3A0B');
  assert.equal(winner(s), 'draw');
  assert.equal(s.status, 'finished');
  assert.throws(() => applyGuess(s, 0, '678'));
});
test('fair ending: first wins after second misses', () => {
  let s = turn(ready(), '012', '3A0B');
  s = turn(s, '345', '0A0B');
  assert.equal(winner(s), 0);
});
test('second-only hit wins immediately, including swapped first', () => {
  let s = turn(ready(1), '012', '0A0B');
  s = turn(s, '345', '3A0B');
  assert.equal(winner(s), 0);
});
test('invalid commitments, replies and setup guesses are rejected', () => {
  assert.throws(() => applyGuess(createGame(), 0, '012'));
  assert.throws(() => applyCommit(createGame(), 0, 'no'));
  const s = applyGuess(ready(), 0, '012');
  for (const r of ['9A0B', '2A1B', '-1A0B', '0A4B', 'garbage'])
    assert.throws(() => applyReply(s, 1, r));
  assert.throws(() => applyReply(s, 0, '0A0B'));
});
test('candidate enumeration and consistency', () => {
  assert.equal(allCodes(3).length, 720);
  assert.equal(allCodes(4).length, 5040);
  const h = [
    { g: '012', r: score('427', '012') },
    { g: '724', r: score('427', '724') },
  ];
  const c = candidates(3, h);
  assert.ok(c.includes('427'));
  assert.ok(c.every((x) => h.every((e) => JSON.stringify(score(x, e.g)) === JSON.stringify(e.r))));
});
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
for (const n of [3, 4])
  test(`normal AI solves 200 seeded ${n}-digit secrets within 10 guesses`, () => {
    const rng = seeded(9081 + n);
    let total = 0,
      max = 0;
    for (let i = 0; i < 200; i++) {
      const codes = allCodes(n),
        secret = codes[Math.floor(rng() * codes.length)],
        h: any[] = [];
      let solved = false;
      for (let k = 1; k <= 10; k++) {
        const g = aiGuess(n, h, 'normal', rng),
          r = score(secret, g);
        assert.ok(candidates(n, h).includes(g));
        h.push({ g, r });
        if (r.a === n) {
          total += k;
          max = Math.max(max, k);
          solved = true;
          break;
        }
      }
      assert.ok(solved, secret);
    }
    console.log(`AI ${n} digits: average ${(total / 200).toFixed(3)} guesses; max ${max}`);
  });
test('easy AI recent-reply branch stays consistent with last reply', () => {
  const h = [
    { g: '012', r: { a: 0, b: 0 } },
    { g: '345', r: { a: 0, b: 1 } },
  ];
  const g = aiGuess(3, h, 'easy', () => 0);
  assert.deepEqual(score(g, '345'), h[1].r);
});

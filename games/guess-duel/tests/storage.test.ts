import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readScores, recordScore } from '../src/ui/storage.ts';
function store() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}
test('scoreboard counts wins and draws independently by names/mode', () => {
  const s = store();
  recordScore(s, 'a', 0);
  recordScore(s, 'a', 1);
  recordScore(s, 'a', 'draw');
  recordScore(s, 'b', 0);
  assert.deepEqual(readScores(s), { a: { wins: [1, 1], draws: 1 }, b: { wins: [1, 0], draws: 0 } });
});
test('scoreboard tolerates corrupt, hostile and unavailable storage', () => {
  const s = store();
  s.setItem('guess-duel-scores', 'broken');
  assert.deepEqual(readScores(s), {});
  s.setItem('guess-duel-scores', JSON.stringify({ a: { wins: [-1, 2], draws: 0 }, b: null }));
  assert.deepEqual(readScores(s), {});
  const broken = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('full');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  assert.doesNotThrow(() => recordScore(broken, 'key', 0));
});
test('results count once per game across reloads', () => {
  const s = store();
  recordScore(s, 'a', 0, 'game1');
  recordScore(s, 'a', 0, 'game1');
  recordScore(s, 'a', 0, 'game2');
  assert.deepEqual(readScores(s).a, { wins: [2, 0], draws: 0 });
});

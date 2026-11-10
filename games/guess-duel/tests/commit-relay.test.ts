import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commit, verify, randomSalt, verifyGame } from '../src/logic/commit.ts';
import { createGame, applyCommit, applyGuess, applyReply, applyReveal } from '../src/logic/game.ts';
import { encode, decode } from '../src/relay/codec.ts';
test('WebCrypto commit round trip and mismatch', async () => {
  const salt = randomSalt();
  assert.match(salt, /^[a-f0-9]{32}$/);
  const hash = await commit('012', salt);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(await verify('012', salt, hash), true);
  assert.equal(await verify('013', salt, hash), false);
});
test('verification rechecks replies, including a valid commitment with a wrong reply', async () => {
  const salt = 'a'.repeat(32);
  let s = createGame();
  for (const seat of [0, 1] as const) s = applyCommit(s, seat, await commit('012', salt));
  s = applyReply(applyGuess(s, 0, '012'), 1, '3A0B');
  s = applyReply(applyGuess(s, 1, '012'), 0, '0A0B');
  for (const seat of [0, 1] as const) s = applyReveal(s, seat, '012', salt);
  assert.equal(await verifyGame(s), false);
});
test('relay round trip, pending guesses and 20-guess budget', () => {
  let s = createGame({ id: '12345678-1234-1234-1234-123456789012', names: ['爸爸', '小朋友'] });
  s = applyCommit(s, 0, 'a'.repeat(64));
  s = applyCommit(s, 1, 'b'.repeat(64));
  for (let i = 0; i < 20; i++) {
    const seat = s.turn;
    s = applyReply(applyGuess(s, seat, '012'), (1 - seat) as 0 | 1, '0A0B');
  }
  assert.deepEqual(decode(encode(s)), s);
  assert.ok(encode(s).length <= 600, `${encode(s).length}`);
  s = applyGuess(s, s.turn, '345');
  assert.deepEqual(decode(encode(s)), s);
  assert.ok(!encode(s).includes('secret'));
});
test('relay rejects malformed, invalid and oversized payloads', () => {
  for (const bad of [
    '',
    '#r=!',
    '#r=abc',
    '#r=' + 'A'.repeat(13000),
    '#r=' + btoa(JSON.stringify(['id', 3, ['A', 'B'], 0, [null, null], '012A', [null, null]])),
  ])
    assert.throws(() => decode(bad));
});
test('relay excludes extra private properties', () => {
  const s = createGame({ id: 'test' });
  (s as any).secret = 'TOPSECRET';
  (s as any).salt = 'PRIVATE';
  const raw = atob(encode(s).slice(3).replace(/-/g, '+').replace(/_/g, '/'));
  assert.ok(!raw.includes('TOPSECRET'));
  assert.ok(!raw.includes('PRIVATE'));
});

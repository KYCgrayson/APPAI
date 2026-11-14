import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/controller.js';
import * as L from '../src/logic.js';
import { seeded } from './helpers.mjs';

function setup(settings = {}) {
  const rng = seeded(42);
  let s = C.newSession({ ...C.defaultSettings(), ...settings }, rng);
  if (s.screen === 'handoff') s = C.transition(s, { type: 'reveal' });
  s = C.transition(s, { type: 'random' }, rng);
  s = C.transition(s, { type: 'ready' });
  if (settings.mode === 'human') {
    s = C.transition(s, { type: 'reveal' });
    s = C.transition(s, { type: 'random' }, rng);
    s = C.transition(s, { type: 'ready' });
    s = C.transition(s, { type: 'reveal' });
  }
  return s;
}
test('defaults use classic fleets, normal computer, no touching or extra shots', () => {
  assert.deepEqual(C.defaultSettings(), { mode: 'ai', level: 'normal', size: 10, touch: false, again: false, theme: 'auto' });
});
test('manual placement requires aim and confirmation, and advances ship selection', () => {
  let s = C.newSession(C.defaultSettings(), seeded(1));
  assert.equal(C.transition(s, { type: 'ready' }), s);
  s = C.transition(s, { type: 'place' });
  assert.equal(s.error, 'chooseCell');
  s = C.transition(s, { type: 'aim', cell: 0 });
  assert.equal(s.game.fleets[0][0], null);
  s = C.transition(s, { type: 'place' });
  assert.deepEqual(s.game.fleets[0][0], [0, 1, 2, 3, 4]);
  assert.equal(s.selected, 1);
  assert.equal(s.aim, null);
  s = C.transition(s, { type: 'aim', cell: 11 });
  s = C.transition(s, { type: 'place' });
  assert.equal(s.error, 'touching');
  assert.equal(s.game.fleets[0][1], null);
});
test('placed ships can be selected, rotated, moved and cleared', () => {
  let s = C.newSession(C.defaultSettings(), seeded(1));
  s = C.transition(s, { type: 'aim', cell: 0 });
  s = C.transition(s, { type: 'place' });
  s = C.transition(s, { type: 'ship', index: 0 });
  s = C.transition(s, { type: 'rotate' });
  s = C.transition(s, { type: 'aim', cell: 20 });
  s = C.transition(s, { type: 'place' });
  assert.deepEqual(s.game.fleets[0][0], [20, 30, 40, 50, 60]);
  s = C.transition(s, { type: 'clear' });
  assert.ok(s.game.fleets[0].every(c => c === null));
  assert.equal(C.transition(s, { type: 'ship', index: 99 }), s);
});
test('computer setup hides its fleet and starts only after placement', () => {
  const s = setup();
  assert.equal(s.screen, 'battle');
  assert.equal(s.game.turn, 0);
  assert.equal(C.viewer(s), 0);
  assert.ok(s.game.fleets.every(f => L.validFleet(10, f)));
});
test('two-player setup and every switched turn use handoff screens', () => {
  const rng = seeded(4);
  let s = C.newSession({ ...C.defaultSettings(), mode: 'human' }, rng);
  assert.equal(s.screen, 'handoff');
  assert.equal(C.viewer(s), 0);
  assert.equal(C.transition(s, { type: 'aim', cell: 0 }), s);
  s = C.transition(s, { type: 'reveal' });
  s = C.transition(s, { type: 'random' }, rng);
  s = C.transition(s, { type: 'ready' });
  assert.equal(s.screen, 'handoff');
  assert.equal(C.viewer(s), 1);
  s = C.transition(s, { type: 'reveal' });
  s = C.transition(s, { type: 'random' }, rng);
  s = C.transition(s, { type: 'ready' });
  assert.equal(s.screen, 'handoff');
  assert.equal(C.viewer(s), 0);
  s = C.transition(s, { type: 'reveal' });
  s = C.transition(s, { type: 'aim', cell: 0 });
  s = C.transition(s, { type: 'fire' });
  assert.equal(C.viewer(s), 0, 'shooter keeps their private board while reading the report');
  assert.equal(s.game.turn, 1);
  s = C.transition(s, { type: 'next' });
  assert.equal(s.screen, 'handoff');
  assert.equal(s.feedback, null);
  assert.equal(C.viewer(s), 1);
});
test('tap-to-aim does not fire, duplicate shots and firing through reports are ignored', () => {
  let s = setup();
  assert.equal(C.transition(s, { type: 'fire' }), s);
  s = C.transition(s, { type: 'aim', cell: 0 });
  assert.equal(s.game.shots[0].length, 0);
  s = C.transition(s, { type: 'fire' });
  assert.equal(s.game.shots[0].length, 1);
  assert.equal(C.transition(s, { type: 'fire' }), s);
  assert.equal(C.transition(s, { type: 'aim', cell: 1 }), s);
  s = C.transition(s, { type: 'next' });
  assert.equal(C.transition(s, { type: 'aim', cell: 1 }), s, 'cannot aim for the computer');
  s = C.transition(s, { type: 'ai' }, seeded(9));
  assert.equal(C.viewer(s), 0, 'computer feedback must never reveal the computer fleet');
  s = C.transition(s, { type: 'next' });
  assert.equal(C.transition(s, { type: 'aim', cell: 0 }), s);
});
test('extra shot stays with the same human without passing the device', () => {
  let s = setup({ mode: 'human', again: true });
  s = C.transition(s, { type: 'aim', cell: s.game.fleets[1][0][0] });
  s = C.transition(s, { type: 'fire' });
  s = C.transition(s, { type: 'next' });
  assert.equal(s.game.turn, 0);
  assert.equal(s.screen, 'battle');
  assert.equal(s.feedback, null);
});
test('new game settings never change an existing session mode or difficulty', () => {
  let s = setup({ level: 'hard' });
  s = C.transition(s, { type: 'home' });
  s = C.transition(s, { type: 'settings', value: { mode: 'human', size: 8, level: 'easy', touch: true } });
  s = C.transition(s, { type: 'resume' });
  assert.equal(s.mode, 'ai');
  assert.equal(s.level, 'hard');
  assert.equal(s.game.size, 10);
  assert.equal(s.game.touch, false);
  s = C.transition(s, { type: 'new' }, seeded(1));
  assert.equal(s.mode, 'human');
  assert.equal(s.level, 'easy');
  assert.equal(s.game.size, 8);
  assert.equal(s.game.touch, true);
});
test('partial placement and settings survive a versioned save', () => {
  let s = C.newSession({ ...C.defaultSettings(), theme: 'dark' }, seeded(1));
  s = C.transition(s, { type: 'aim', cell: 0 });
  s = C.transition(s, { type: 'place' });
  const raw = C.serialize(s, 'hi'), restored = C.restore(raw);
  assert.equal(JSON.parse(raw).version, 1);
  assert.equal(JSON.parse(raw).locale, 'hi');
  assert.equal(restored.settings.theme, 'dark');
  assert.deepEqual(restored.game, s.game);
  assert.equal(restored.aim, null);
});
test('shared-device reload and home resume always conceal private boards', () => {
  for (const stage of ['place', 'battle', 'feedback', 'handoff']) {
    let s = stage === 'place' ? C.transition(C.newSession({ ...C.defaultSettings(), mode: 'human' }, seeded(1)), { type: 'reveal' }) : setup({ mode: 'human' });
    if (['feedback', 'handoff'].includes(stage)) {
      s = C.transition(s, { type: 'aim', cell: 0 });
      s = C.transition(s, { type: 'fire' });
    }
    if (stage === 'handoff') s = C.transition(s, { type: 'next' });
    const restored = C.restore(C.serialize(s));
    assert.equal(restored.screen, 'handoff', stage);
    assert.equal(restored.feedback, null, stage);
    assert.deepEqual(restored.game, s.game, stage);
    const home = C.transition(s, { type: 'home' });
    assert.equal(C.restore(C.serialize(home)).screen, 'home');
    assert.equal(C.transition(home, { type: 'resume' }).screen, 'handoff');
  }
});
test('save replay reconstructs shots rather than trusting stored results', () => {
  let s = setup();
  s = C.transition(s, { type: 'aim', cell: 0 });
  s = C.transition(s, { type: 'fire' });
  const saved = JSON.parse(C.serialize(s));
  saved.state.game.shots = [[], []];
  saved.state.game.winner = 1;
  const restored = C.restore(JSON.stringify(saved));
  assert.deepEqual(restored.game, s.game);
  saved.state.log.push({ player: 0, cell: 0 });
  assert.equal(C.restore(JSON.stringify(saved)), null);
});
test('broken and incompatible saves fail safely', () => {
  for (const raw of [null, '', '{', '{}', '{"version":2,"state":{}}']) assert.equal(C.restore(raw), null);
  const s = setup();
  s.game.fleets[0][0] = [0, 1, 2, 12, 22];
  assert.equal(C.restore(C.serialize(s)), null);
});
for (const mode of ['ai', 'human']) {
  test(`${mode}: complete controller flow through winner, reload, home and play again`, () => {
    let s = setup({ mode, size: 8, again: true }), steps = 0;
    while (s.screen !== 'result') {
      assert.ok(++steps < 1000);
      if (s.screen === 'handoff') { s = C.transition(s, { type: 'reveal' }); continue; }
      if (s.feedback) { s = C.transition(s, { type: 'next' }); continue; }
      if (mode === 'ai' && s.game.turn === 1) { s = C.transition(s, { type: 'ai' }, seeded(steps)); continue; }
      const p = s.game.turn;
      const cell = s.game.fleets[1 - p].flat().find(c => !s.game.shots[p].some(shot => shot.cell === c));
      s = C.transition(s, { type: 'aim', cell });
      s = C.transition(s, { type: 'fire' });
    }
    assert.notEqual(s.game.winner, null);
    const restored = C.restore(C.serialize(s));
    assert.equal(restored.screen, 'result');
    assert.deepEqual(restored.game, s.game);
    assert.equal(C.transition(s, { type: 'home' }).screen, 'home');
    const fresh = C.transition(s, { type: 'new' }, seeded(90));
    assert.equal(fresh.game.winner, null);
    assert.deepEqual(fresh.game.shots, [[], []]);
    assert.equal(fresh.screen, mode === 'human' ? 'handoff' : 'place');
  });
}

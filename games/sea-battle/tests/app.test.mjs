// Render and interaction smoke checks using a tiny document surface, without a browser or DOM library.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import * as C from '../src/controller.js';
import { LANGUAGES, STRINGS, translate } from '../src/i18n.js';
import { seeded } from './helpers.mjs';

test('every locale renders home, placement, battle, privacy and result screens without missing copy', async () => {
  const original = Object.getOwnPropertyDescriptors(globalThis);
  const stub = { focus() {}, content: '' }, announcer = { textContent: '' };
  let scheduledAi = null;
  const listeners = {};
  const root = { innerHTML: '', addEventListener: (name, fn) => { listeners[name] = fn; }, querySelector: () => stub };
  const document = { documentElement: { dataset: {} }, title: '',
    getElementById: id => id === 'app' ? root : id === 'announcer' ? announcer : stub,
    querySelector: () => stub };
  const fixtures = [];
  fixtures.push(C.initialState());
  let state = C.newSession(C.defaultSettings(), seeded(5));
  fixtures.push(state);
  state = C.transition(C.transition(state, { type: 'random' }, seeded(7)), { type: 'ready' });
  fixtures.push(state);
  fixtures.push(C.newSession({ ...C.defaultSettings(), mode: 'human' }, seeded(1)));
  let end = state;
  // An alternating whole game provides a valid, replayable result fixture.
  while (end.screen !== 'result') {
    if (end.feedback) { end = C.transition(end, { type: 'next' }); continue; }
    if (end.game.turn === 1) { end = C.transition(end, { type: 'ai' }, seeded(end.log.length)); continue; }
    const cell = end.game.fleets[1].flat().find(c => !end.game.shots[0].some(s => s.cell === c));
    end = C.transition(C.transition(end, { type: 'aim', cell }), { type: 'fire' });
  }
  fixtures.push(end);
  try {
    for (const [key, value] of Object.entries({ document, navigator: { languages: ['en'] }, history: { replaceState() {} },
      setTimeout: callback => { scheduledAi = callback; return 1; }, clearTimeout: () => { scheduledAi = null; }
    })) Object.defineProperty(globalThis, key, { value, configurable: true });
    for (const locale of Object.keys(LANGUAGES)) for (let i = 0; i < fixtures.length; i++) {
      let stored = C.serialize(fixtures[i], locale);
      Object.defineProperty(globalThis, 'location', { value: { search: `?lang=${locale}`, href: `http://localhost:5185/?lang=${locale}` }, configurable: true });
      Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => stored, setItem: (_, value) => { stored = value; } }, configurable: true });
      await import(`../src/app.js?smoke=${locale}-${i}`);
      assert.equal(document.documentElement.lang, locale);
      assert.equal(document.title, STRINGS[locale].title);
      assert.ok(root.innerHTML.includes('<main'));
      assert.ok(!/\{(?:player|coord|result|n|total)\}/.test(root.innerHTML));
      if (i === 0) {
        assert.ok(root.innerHTML.includes('href="/games"'));
        assert.ok(root.innerHTML.includes('A–J / 1–10'));
        listeners.change({ target: { dataset: { setting: 'size' }, value: '8', type: 'select-one' } });
        assert.ok(root.innerHTML.includes('A–H / 1–8'));
        listeners.change({ target: { dataset: { setting: 'size' }, value: '10', type: 'select-one' } });
        assert.ok(root.innerHTML.includes('A–J / 1–10'));
      }
      if (i === 3) assert.ok(!root.innerHTML.includes('role="grid"'), 'handoff contains no private board in the markup');
      if (i === 2) {
        const target = root.innerHTML.split('data-sea="target"')[1].split('data-sea="own"')[0];
        assert.ok(!target.includes('■'), 'unshot enemy ships must not appear on the target sea');
        // Aim and fire exercise the actual event wiring, with confirmation between them.
        const cell = { dataset: { cell: '0' }, closest: () => ({ dataset: { sea: 'target' } }) };
        listeners.click({ target: { closest: selector => selector === 'button[data-cell]' ? cell : null } });
        assert.equal(JSON.parse(stored).state.game.shots[0].length, 0);
        const click = action => listeners.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action } } : null } });
        click('fire');
        assert.equal(JSON.parse(stored).state.game.shots[0].length, 1);
        assert.ok(announcer.textContent.includes('A1'));
        const human = translate(locale, 'player', { n: 1 }), computer = translate(locale, 'computerName');
        const heading = player => `<h1>${translate(locale, 'turn', { player })}</h1>`;
        assert.ok(root.innerHTML.includes(heading(human)), 'report heading keeps the shooter until Continue');
        assert.ok(!announcer.textContent.includes(computer), 'shot announcement does not announce the next player');
        assert.equal(scheduledAi, null, 'computer waits for Continue');
        click('next');
        assert.ok(root.innerHTML.includes(heading(computer)));
        assert.equal(typeof scheduledAi, 'function');
        scheduledAi();
        assert.equal(JSON.parse(stored).state.game.shots[1].length, 1);
        assert.ok(root.innerHTML.includes(heading(computer)), 'computer report also keeps its shooter heading');
        assert.ok(!announcer.textContent.includes(human));
        click('next');
        assert.ok(root.innerHTML.includes(heading(human)), 'Continue advances the heading to the next player');
      }
    }
  } finally {
    for (const key of ['document', 'navigator', 'history', 'location', 'localStorage', 'setTimeout', 'clearTimeout']) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else delete globalThis[key];
    }
  }
});
test('static entry keeps the sync insertion marker and ships under 150 KB without network clients', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<meta charset="utf-8">'));
  const source = new URL('../src/', import.meta.url);
  let bytes = Buffer.byteLength(html);
  for (const name of await readdir(source)) {
    bytes += (await stat(new URL(name, source))).size;
    const text = await readFile(new URL(name, source), 'utf8');
    assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(text), name);
    assert.ok(!/https?:\/\//.test(text), name);
  }
  assert.ok(bytes < 150_000, `${bytes} bytes shipped`);
});

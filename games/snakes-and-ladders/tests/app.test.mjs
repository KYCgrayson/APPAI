import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, reduceMove } from '../src/logic.js';
import { defaults, restore, STORAGE_KEY, mayRoll, animationFrames } from '../src/controller.js';
import { boardSvg } from '../src/art.js';
import { messages } from '../src/i18n.js';
import { FakeServer, memoryStorage } from './fake-server.mjs';

test('versioned save preserves settings, current turn, finish and online resume marker', () => {
  const game = reduceMove(createGame({ again: true }), 0, { roll: 6 });
  const data = restore(JSON.stringify({ v: 1, settings: { ...defaults(), theme: 'dark' }, local: game, screen: 'local' }));
  assert.deepEqual(data.local, game); assert.equal(data.screen, 'local'); assert.equal(data.settings.theme, 'dark');
  assert.equal(restore({ v: 1, settings: defaults(), screen: 'online', roomCode: 'ABC234' }).screen, 'online');
  for (const raw of ['broken JSON', '{"v":2}', null]) assert.equal(restore(raw).screen, 'home');
});
test('controller only offers roll to the active human or room seat', () => {
  const game = createGame();
  assert.equal(mayRoll(game, 'local'), true);
  assert.equal(mayRoll(reduceMove(game, 0, { roll: 1 }), 'local'), false);
  assert.equal(mayRoll(game, 'online', 0), true); assert.equal(mayRoll(game, 'online', 1), false);
  assert.equal(mayRoll(game, 'online', 0, true), false); assert.equal(mayRoll(game, 'local', 0, false, true), false);
});
test('animation walks numbered squares before connections; SVG keeps number and shape labels', () => {
  const game = reduceMove(createGame(), 0, { roll: 2 });
  assert.deepEqual(animationFrames(game.last), [{ square: 1, jump: false }, { square: 2, jump: false }, { square: 23, jump: true }]);
  for (const board of ['classic', 'short']) {
    const svg = boardSvg(createGame({ board, players: Array(4).fill('human') }), 'Board');
    assert.equal((svg.match(/class="number"/g) ?? []).length, board === 'classic' ? 100 : 50);
    for (let i = 0; i < 4; i++) assert.match(svg, new RegExp(`id="token-${i}"`));
    assert.match(svg, /role="img"/); assert.doesNotMatch(svg, /<image|https?:|<script/);
  }
});

// Tiny DOM-free shell: verifies the actual app entry point, event handlers and
// localStorage transitions. No browser, jsdom, packages, or layout emulation.
let imports = 0;
async function harness({ url = 'http://localhost:5184/?lang=en', saved, server, storage = memoryStorage(), reduced = true, randomWord } = {}) {
  const handlers = {}, documentHandlers = {}, settingsElement = { open: false };
  let html = '', renders = 0;
  const frames = [], token = { setAttribute: (_name, transform) => frames.push(transform) }; let now = performance.now();
  if (saved) storage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const app = { get innerHTML() { return html; }, set innerHTML(value) { html = value; renders++; }, addEventListener: (type, fn) => { handlers[type] = fn; }, querySelector(selector) {
    if (selector === '.settings') return settingsElement;
    if (selector === '.settings[open]') return settingsElement.open ? settingsElement : null;
    if (selector === '#board-svg') return app.innerHTML.includes('id="board-svg"') ? {} : null;
    return null;
  } };
  const announcer = { textContent: '' };
  const document = { activeElement: {}, hidden: false, title: '', documentElement: { dataset: {} }, querySelector: key => key === '#app' ? app : key === '#announcer' ? announcer : key.startsWith('#token-') ? token : null, getElementById: () => null, addEventListener: (type, fn) => { documentHandlers[type] = fn; } };
  const globals = { window: { localStorage: storage }, document, navigator: { languages: ['en'], clipboard: { writeText: async () => {} } }, location: new URL(url), history: { replaceState: (_a, _b, next) => { globalThis.location = new URL(next); } }, matchMedia: () => ({ matches: reduced }), requestAnimationFrame: fn => { now = Math.max(now + 120, performance.now() + 120); fn(now); return 1; } };
  if (randomWord !== undefined) globals.crypto = { getRandomValues(a) { a[0] = randomWord; } };
  const old = new Map();
  for (const [key, value] of Object.entries(globals)) { old.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  if (server) { old.set('fetch', Object.getOwnPropertyDescriptor(globalThis, 'fetch')); globalThis.fetch = server.fetch; }
  await import(`../src/app.js?test=${++imports}`);
  return { app, announcer, document, storage, frames, get renders() { return renders; },
    click: action => handlers.click({ target: { closest: () => ({ dataset: { action } }) } }),
    change: (id, value, extra = {}) => handlers.change({ target: { id, value, dataset: {}, ...extra } }),
    input: value => handlers.input({ target: { id: 'room-input', value } }),
    async submit() {
      let prevented = false;
      handlers.submit({ target: { id: 'join-form' }, preventDefault() { prevented = true; } });
      await new Promise(resolve => setImmediate(resolve));
      return prevented;
    },
    async cleanup() {
      await handlers.click({ target: { closest: () => ({ dataset: { action: 'home' } }) } });
      for (const [key, desc] of old) if (desc) Object.defineProperty(globalThis, key, desc); else delete globalThis[key];
    },
  };
}
test('actual local app: home → play → reloadable save → win → again → home; all locales render', async () => {
  const nearWin = { ...createGame({ exact: false, players: ['human', 'human'] }), positions: [99, 0] };
  const h = await harness({ saved: { v: 1, settings: { ...defaults(), players: ['human', 'human'] }, local: nearWin, screen: 'home' } });
  try {
    assert.match(h.app.innerHTML, /Snakes and Ladders/); assert.match(h.app.innerHTML, /href="\/games"/);
    for (const locale of Object.keys(messages)) { h.change('language', locale); assert.equal(h.document.title, messages[locale].title); assert.equal(h.document.documentElement.lang, locale); }
    h.change('language', 'en'); await h.click('resume'); assert.match(h.app.innerHTML, /Roll die/);
    await h.click('roll'); const persisted = JSON.parse(h.storage.getItem(STORAGE_KEY));
    assert.equal(persisted.local.status, 'finished'); assert.match(h.app.innerHTML, /Player 1 wins!/); assert.match(h.announcer.textContent, /wins/);
    await h.click('again'); assert.deepEqual(JSON.parse(h.storage.getItem(STORAGE_KEY)).local.positions, [0, 0]);
    await h.click('home'); assert.match(h.app.innerHTML, /Resume game/);
  } finally { await h.cleanup(); }
});
test('actual app: automatic local reload resumes with the saved board and theme', async () => {
  const local = reduceMove(createGame({ board: 'short', players: ['human', 'human'] }), 0, { roll: 3 });
  const h = await harness({ saved: { v: 1, settings: { ...defaults(), theme: 'dark' }, local, screen: 'local' } });
  try { assert.match(h.app.innerHTML, /Player 2’s turn/); assert.match(h.app.innerHTML, /Square 3/); assert.equal(h.document.documentElement.dataset.theme, 'dark'); }
  finally { await h.cleanup(); }
});
test('actual app animates the route and ladder; reduced motion skips animation', async () => {
  for (const reduced of [false, true]) {
    const h = await harness({ reduced, randomWord: 1, saved: { v: 1, settings: { ...defaults(), players: ['human', 'human'] }, screen: 'home' } });
    try {
      await h.click('new'); await h.click('roll');
      assert.equal(JSON.parse(h.storage.getItem(STORAGE_KEY)).local.positions[0], 23);
      assert.equal(h.frames.length > 0, !reduced); assert.match(h.app.innerHTML, /Up the ladder/);
    } finally { await h.cleanup(); }
  }
});
test('leaving home during a pending create does not pull the user into a late room', async () => {
  const fake = new FakeServer(); let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const h = await harness({ server: { fetch: async (...args) => { await gate; return fake.fetch(...args); } } });
  try {
    await h.click('online-mode'); const pending = h.click('create'); await h.click('home'); finish(); await pending;
    assert.equal(JSON.parse(h.storage.getItem(STORAGE_KEY)).screen, 'home'); assert.match(h.app.innerHTML, /Create room/); assert.doesNotMatch(h.app.innerHTML, /<h2>Waiting for friends/);
  } finally { await h.cleanup(); }
});
test('actual app: room URL prefills join, create failure displays translated sign-in link', async () => {
  const server = new FakeServer(); server.signedIn = false;
  const h = await harness({ url: 'https://appai.info/games/snakes-and-ladders?lang=hi&room=ABC234', server });
  try {
    assert.match(h.app.innerHTML, /value="ABC234"/); await h.click('create');
    assert.match(h.app.innerHTML, /https:\/\/appai.info\/api\/auth\/signin/); assert.match(h.app.innerHTML, /साइन इन/);
  } finally { await h.cleanup(); }
});
test('actual app: room creation persists credentials, and online reload opens the lobby', async () => {
  const server = new FakeServer(), storage = memoryStorage();
  const h = await harness({ server, storage });
  try { await h.click('online-mode'); await h.click('create'); assert.match(h.app.innerHTML, /Waiting for friends/); assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).screen, 'online'); }
  finally { await h.cleanup(); }
  // Cleanup is the Home action, so explicitly model reloading before leaving.
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)); saved.screen = 'online'; storage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const h2 = await harness({ server, storage });
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.match(h2.app.innerHTML, /Waiting for friends/); assert.match(h2.app.innerHTML, /ABC234/);
  } finally { await h2.cleanup(); }
});
test('room-code typing and blur preserve the Join button; its native form submits by tap or Enter', async () => {
  for (const trigger of ['tap', 'Enter']) {
    const server = new FakeServer();
    await server.fetch('https://appai.info/api/rooms', { method: 'POST', body: JSON.stringify({ game: 'snakes-and-ladders', seats: 4, state: createGame({ players: Array(4).fill('human') }), turn: 0 }) });
    const h = await harness({ server });
    try {
      await h.click('online-mode');
      assert.match(h.app.innerHTML, /<form id="join-form">[\s\S]*<input id="room-input"[^>]*>[\s\S]*<button type="submit"/);
      const renders = h.renders;
      h.input('abc234');
      if (trigger === 'tap') h.change('room-input', 'abc234'); // Blur precedes the first click.
      assert.equal(h.renders, renders, `${trigger}: typing/blur must not replace the submit button`);
      assert.equal(await h.submit(), true, `${trigger}: prevent native navigation`);
      assert.equal(server.calls.filter(call => new URL(call.url).pathname.endsWith('/join')).length, 1);
      assert.equal(JSON.parse(h.storage.getItem(STORAGE_KEY)).screen, 'online');
      assert.match(h.app.innerHTML, /Waiting for friends/);
    } finally { await h.cleanup(); }
  }
});
test('all setup inputs update and persist only their intended settings', async () => {
  const h = await harness();
  try {
    for (const [id, value, extra, expected] of [
      ['theme', 'dark', {}, { theme: 'dark' }],
      ['board', 'short', {}, { board: 'short' }],
      ['count', '4', {}, { players: ['human', 'computer', 'human', 'human'] }],
      ['seat-1', 'human', { dataset: { seat: '1' } }, { players: Array(4).fill('human') }],
      ['exact', 'on', { checked: false }, { exact: false }],
      ['again', 'on', { checked: true }, { again: true }],
    ]) {
      h.change(id, value, extra);
      const settings = JSON.parse(h.storage.getItem(STORAGE_KEY)).settings;
      for (const [key, expectedValue] of Object.entries(expected)) assert.deepEqual(settings[key], expectedValue);
    }
    const renders = h.renders;
    h.change('unrelated-input', 'unused');
    assert.equal(h.renders, renders);
  } finally { await h.cleanup(); }
});
test('static entry is sync-compatible, local, and has the live announcer', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<meta charset="utf-8">/); assert.match(html, /aria-live="polite"/); assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /https?:|cdn|analytics/i);
});

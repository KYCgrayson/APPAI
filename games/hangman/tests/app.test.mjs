import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as C from '../src/controller.js';
import { normalizeKey, analyzeWord } from '../src/alphabet.js';
import { remaining, status, keyboardState } from '../src/logic.js';
import { WORDS } from '../src/words/index.js';
import { resolveLocale, t, STRINGS } from '../src/i18n.js';
import { renderView } from '../src/view.js';

// Only browser boundaries are faked. Execute the shipped app, renderer and rules.
const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8').replace(/^import .+;\n/gm, '');
const decode = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, c) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[c]);
function mount(saved, { query = '', languages = ['en'], blocked = false } = {}) {
  let html = '', elements = [], serialized = saved ? JSON.stringify(saved) : null;
  const rootEvents = {}, documentEvents = {}, timers = new Map();
  let timerId = 0, focused = '', href = `http://localhost:5183/${query}`;
  const live = { textContent: '' };
  const find = selector => {
    if (selector === '.key:not(:disabled)') return elements.find(e => e.dataset.action === 'guess' && !e.disabled);
    if (selector.startsWith('#')) return elements.find(e => e.id === selector.slice(1));
    return null;
  };
  const root = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      elements = [...html.matchAll(/<(button|select|input|h1)\b([^>]*)>/g)].map(m => {
        const attrs = Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], decode(a[2])]));
        return {
          id: attrs.id, type: attrs.type, value: attrs.value || '', disabled: /\bdisabled\b/.test(m[2]),
          dataset: { action: attrs['data-action'], value: attrs['data-value'], setting: attrs['data-setting'] },
          focus() { focused = this.id || this.dataset.action; },
          setAttribute(name, value) { attrs[name] = value; },
          closest(selector) { return selector === '[data-action]' ? this : null; },
        };
      });
    },
    querySelector: find,
    addEventListener: (name, handler) => { rootEvents[name] = handler; },
  };
  const storage = {
    getItem: () => serialized,
    setItem: (key, value) => { assert.equal(key, C.STORAGE_KEY); if (blocked) throw Error('full'); serialized = value; },
  };
  const context = {
    C, normalizeKey, remaining, status, keyboardState, WORDS, resolveLocale, t, renderView, URL, URLSearchParams,
    document: {
      documentElement: { dataset: {} }, title: '',
      getElementById: id => id === 'app' ? root : id === 'live' ? live : find(`#${id}`),
      addEventListener: (name, handler) => { documentEvents[name] = handler; },
    },
    window: { localStorage: storage }, navigator: { languages },
    location: { get href() { return href; }, search: query },
    history: { replaceState: (_, __, url) => { href = String(url); } },
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
  };
  vm.runInNewContext(source, context);
  const flush = () => { for (const fn of timers.values()) fn(); timers.clear(); };
  flush();
  return {
    html: () => html, saved: () => JSON.parse(serialized), context, focused: () => focused, href: () => href,
    live: () => live.textContent,
    click(action, value) {
      const element = elements.find(e => e.dataset.action === action && (value === undefined || e.dataset.value === value));
      assert.ok(element, `Missing ${action}/${value}`);
      rootEvents.click({ target: element }); flush();
    },
    change(id, value) {
      const element = find(`#${id}`); assert.ok(element, id); element.value = value;
      rootEvents.change({ target: element }); flush();
    },
    secret(word, hint = '') {
      find('#secret').value = word; find('#secret-clue').value = hint;
      rootEvents.submit({ target: { id: 'secret-form' }, preventDefault() {} }); flush();
    },
    key(value, target = null, extra = {}) {
      documentEvents.keydown({ key: value, target: target || { closest: () => null }, preventDefault() {}, ...extra }); flush();
    },
  };
}
test('shipped app boots with locale, title, live region and saved theme', () => {
  const s = C.settings(C.defaults(), 'theme', 'dark');
  const app = mount(s, { query: '?lang=zh-HK' });
  assert.equal(app.context.document.documentElement.lang, 'zh-TW');
  assert.equal(app.context.document.title, STRINGS['zh-TW'].title);
  assert.equal(app.context.document.documentElement.dataset.theme, 'dark');
  assert.equal(app.live(), STRINGS['zh-TW'].title);
  assert.equal(app.saved().settings.theme, 'dark');
});
test('settings and language picker persist without discarding an active secret', () => {
  const app = mount();
  app.change('wordLanguage', 'fr'); app.click('mode', 'duo'); app.click('start');
  app.secret('école', 'Un endroit pour apprendre');
  app.click('ready'); app.change('language', 'hi');
  assert.equal(app.context.document.documentElement.lang, 'hi');
  assert.match(app.href(), /lang=hi/);
  assert.equal(app.saved().game.locale, 'fr');
  assert.equal(app.saved().game.entry.word, 'école');
  assert.ok(app.html().includes(STRINGS.hi.turnDuo));
  assert.ok(!app.html().includes('école'));
});
test('real click and keyboard handlers complete a game, announce and replay', () => {
  const app = mount(); app.click('start');
  const required = analyzeWord(app.saved().game.entry.word, 'en').required;
  app.click('guess', required[0]);
  for (const key of required.slice(1)) app.key(key.toUpperCase());
  assert.equal(app.saved().screen, 'end'); assert.equal(app.saved().stats.wins, 1);
  assert.match(app.live(), /You found it!/);
  app.click('again'); assert.equal(app.saved().screen, 'play');
  app.click('new'); assert.equal(app.saved().screen, 'home'); assert.equal(app.saved().game, null);
});
test('secret input toggle, validation and covered handoff use the real handlers', () => {
  const app = mount(); app.click('mode', 'duo'); app.click('start');
  app.click('show'); app.secret('<bad>');
  assert.equal(app.saved().screen, 'setup');
  assert.ok(app.html().includes(STRINGS.en.invalidWord));
  assert.ok(app.html().includes('type="text"'));
  app.click('show'); app.secret('pineapple', 'A fruit with a crown');
  assert.equal(app.saved().screen, 'handoff');
  assert.ok(!app.html().includes('pineapple')); assert.ok(!app.html().includes('A fruit with a crown'));
  app.click('ready'); app.click('clue');
  assert.ok(app.html().includes('A fruit with a crown'));
  app.click('hint'); assert.equal(app.saved().game.hints.length, 1);
  assert.equal(app.focused(), 'hint-button');
  assert.match(app.live(), /Hint:/);
});
test('typing into settings, IME composition and modifier shortcuts never guess', () => {
  const app = mount(); app.click('start');
  app.key('x', { closest: () => ({}) });
  app.key('x', null, { isComposing: true }); app.key('x', null, { ctrlKey: true });
  app.key('x', null, { metaKey: true }); app.key('x', null, { repeat: true });
  assert.equal(app.saved().game.guesses.length, 0);
});
test('resuming after choosing another mode retains the original game mode', () => {
  const app = mount(); app.click('start'); app.click('home'); app.click('mode', 'duo');
  app.click('resume'); assert.equal(app.saved().mode, 'solo');
  const loaded = mount(app.saved());
  assert.equal(loaded.saved().screen, 'play');
  assert.equal(loaded.saved().game.entry.word, app.saved().game.entry.word);
});
test('empty filters and blocked storage show friendly translated messages', () => {
  const app = mount(null, { query: '?lang=es', blocked: true });
  assert.ok(app.html().includes(STRINGS.es.savedFail));
  app.change('wordLanguage', 'en'); app.change('category', 'colors'); app.change('difficulty', 'hard'); app.click('start');
  assert.ok(app.html().includes(STRINGS.es.emptyPool));
  assert.equal(app.live(), STRINGS.es.emptyPool);
  assert.equal(app.focused(), 'start-button');
});

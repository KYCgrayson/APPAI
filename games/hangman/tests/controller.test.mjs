import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/controller.js';
import { analyzeWord, ALPHABETS, LOCALES } from '../src/alphabet.js';
import { status } from '../src/logic.js';
import { WORDS } from '../src/words/index.js';
import { renderView } from '../src/view.js';
import { STRINGS } from '../src/i18n.js';

function memory() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
}
const solve = state => analyzeWord(state.game.entry.word, state.game.locale).required.reduce((s, k) => C.takeTurn(s, 'guess', k), state);
test('solo home → play → win → reload counts a single win and streak', () => {
  const storage = memory();
  let s = C.startSolo(C.defaults(), WORDS.en, 'en', () => 0);
  assert.equal(s.screen, 'play');
  s = solve(s);
  assert.equal(s.screen, 'end'); assert.equal(s.counted, true);
  assert.deepEqual(s.stats, { wins: 1, streak: 1, best: 1 });
  assert.equal(C.saveSession(storage, s), true);
  const loaded = C.loadSession(storage);
  assert.deepEqual(loaded.stats, s.stats);
  assert.equal(loaded.screen, 'end');
  assert.equal(C.takeTurn(loaded, 'hint'), loaded);
  s = solve(C.startSolo(loaded, WORDS.en, 'en', () => 0));
  assert.deepEqual(s.stats, { wins: 2, streak: 2, best: 2 });
});
test('a loss resets the completed-game streak but keeps the win record', () => {
  let s = solve(C.startSolo(C.defaults(), WORDS.en, 'en', () => 0));
  s = C.startSolo(s, WORDS.en, 'en', () => 0);
  const required = analyzeWord(s.game.entry.word, 'en').required;
  for (const k of ALPHABETS.en.filter(k => !required.includes(k)).slice(0, 8)) s = C.takeTurn(s, 'guess', k);
  assert.equal(s.screen, 'end'); assert.equal(status(s.game), 'lost');
  assert.deepEqual(s.stats, { wins: 1, streak: 0, best: 1 });
});
test('duo entry → covered handoff → guesses → reload → handoff → win', () => {
  const storage = memory();
  let s = C.beginDuo(C.defaults());
  assert.equal(s.screen, 'setup');
  assert.equal(C.restoreSession(s).screen, 'home');
  s = C.setSecret(s, 'pineapple', 'A fruit with a crown', 'en');
  assert.equal(s.screen, 'handoff');
  let html = renderView(s, 'en');
  assert.ok(!html.includes('pineapple')); assert.ok(!html.includes('A fruit with a crown'));
  assert.equal(C.takeTurn(s, 'guess', 'p'), s);
  s = C.takeTurn(C.ready(s), 'guess', 'p');
  C.saveSession(storage, s);
  const loaded = C.loadSession(storage);
  assert.equal(loaded.screen, 'handoff'); assert.deepEqual(loaded.game.guesses, ['p']);
  html = renderView(C.ready(loaded), 'en');
  assert.ok(!html.includes('pineapple')); assert.ok(!html.includes('A fruit with a crown'));
  s = solve(C.ready(loaded));
  assert.equal(s.screen, 'end');
  html = renderView(s, 'en');
  assert.ok(html.includes('pineapple')); assert.ok(html.includes(STRINGS.en.duoWinner));
  assert.equal(s.stats.wins, 1);
});
test('duo result names the setter on a loss and the guesser on a win', () => {
  let s = C.ready(C.setSecret(C.beginDuo(C.defaults()), 'a', '', 'en'));
  for (const key of 'bcdefghi') s = C.takeTurn(s, 'guess', key);
  assert.ok(renderView(s, 'es').includes(STRINGS.es.setterWinner));
});
test('separate word language, settings validation and chosen secret category', () => {
  let s = C.settings(C.defaults(), 'wordLanguage', 'hi');
  s = C.settings(s, 'theme', 'dark');
  s = C.settings(s, 'category', 'animals');
  assert.equal(C.wordLocale(s, 'en'), 'hi');
  assert.equal(C.settings(s, 'theme', 'neon'), s);
  assert.equal(C.settings(s, '__proto__', 'bad'), s);
  s = C.setSecret(C.beginDuo(s), 'बिल्ली', 'पालतू जानवर', 'hi');
  assert.equal(s.game.entry.category, 'animals');
  assert.equal(C.restoreSession(s).settings.theme, 'dark');
  assert.equal(C.wordLocale(C.defaults(), 'fr'), 'fr');
});
test('resuming from home retains guesses and protects duo secrets', () => {
  let s = C.startSolo(C.defaults(), WORDS.fr, 'fr', () => 0);
  s = C.takeTurn(s, 'hint', null, () => 0);
  const home = { ...s, screen: 'home' };
  assert.equal(C.restoreSession(home).screen, 'home');
  assert.deepEqual(C.resume(home).game, s.game);
  assert.equal(C.resume(home).screen, 'play');
  const duo = C.ready(C.setSecret(C.beginDuo(C.defaults()), 'cat', '', 'en'));
  assert.equal(C.resume({ ...duo, screen: 'home' }).screen, 'handoff');
  assert.equal(C.resume(C.defaults()).screen, 'home');
});
test('corrupt JSON, unsupported versions and unavailable storage are harmless', () => {
  assert.deepEqual(C.loadSession({ getItem: () => '{broken' }), C.defaults());
  assert.deepEqual(C.restoreSession({ version: 99 }), C.defaults());
  assert.deepEqual(C.loadSession(null), C.defaults());
  assert.equal(C.saveSession({ setItem() { throw Error('full'); } }, C.defaults()), false);
  assert.equal(C.saveSession(null, C.defaults()), false);
});
test('bad saved game keeps valid settings but cannot enter a game screen', () => {
  let s = C.startSolo(C.defaults(), WORDS.en, 'en', () => 0);
  s = C.settings(s, 'theme', 'dark');
  const bad = C.restoreSession({ ...s, game: { ...s.game, guesses: ['<'] } });
  assert.equal(bad.screen, 'home'); assert.equal(bad.game, null); assert.equal(bad.settings.theme, 'dark');
  assert.deepEqual(C.restoreSession({ ...C.defaults(), stats: { wins: -1, streak: 100, best: 0 } }).stats, C.defaults().stats);
});
test('secret input is validated and arbitrary clues are escaped', () => {
  const s = C.beginDuo(C.defaults());
  assert.throws(() => C.setSecret(s, '<bad>', '', 'en'));
  assert.throws(() => C.setSecret(s, 'cat', 'x'.repeat(161), 'en'));
  const set = C.ready(C.setSecret(s, 'cat', '<img src=x onerror=alert(1)>', 'en'));
  const html = renderView({ ...set, clue: true }, 'en');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
  const entry = renderView(s, 'en', { draft: { word: '" autofocus onfocus="bad', hint: '<script>', show: false } });
  assert.ok(entry.includes('type="password"'));
  assert.ok(entry.includes('&quot; autofocus'));
});
test('impossible category/length selections do not replace a saved game', () => {
  let s = C.startSolo(C.defaults(), WORDS.en, 'en', () => 0);
  s = C.settings(C.settings(s, 'category', 'colors'), 'difficulty', 'hard');
  assert.equal(C.startSolo(s, WORDS.en, 'en'), null);
  assert.equal(s.game.entry.word, 'cat');
});
for (const locale of LOCALES) test(`${locale}: all screens render with complete copy and usable semantic controls`, () => {
  let state = C.defaults();
  const home = renderView(state, locale);
  assert.ok(home.includes('href="/games"'));
  assert.ok(home.includes('id="language"')); assert.ok(home.includes('id="theme"'));
  assert.ok(home.includes(STRINGS[locale].title));
  const setup = renderView(C.beginDuo(state), locale);
  assert.ok(setup.includes('autocomplete="off"'));
  assert.ok(setup.includes('aria-controls="secret"'));
  assert.ok(!setup.includes('href="/games"'));
  state = C.startSolo(state, WORDS[locale], locale, () => 0);
  for (const html of [home, setup, renderView(state, locale), renderView(solve(state), locale)]) {
    assert.ok(!html.includes('undefined')); assert.ok(!html.includes('[object Object]'));
    assert.ok(!html.match(/\{(?:wins|streak|best|n|total|key|state)\}/));
  }
  const play = renderView(state, locale);
  assert.equal([...play.matchAll(/data-action="guess"/g)].length, ALPHABETS[locale].length);
  assert.ok(play.includes(`lang="${locale}"`));
  assert.ok(play.includes('aria-label='));
  const end = renderView(solve(state), locale);
  assert.ok(end.includes('data-action="again"')); assert.ok(end.includes('category-art'));
  if (locale.startsWith('zh')) {
    assert.ok(!play.includes(state.game.entry.answer));
    assert.ok(end.includes(state.game.entry.answer));
  }
});

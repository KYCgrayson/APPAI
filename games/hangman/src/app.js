import { normalizeKey } from './alphabet.js';
import * as C from './controller.js';
import { remaining, status, keyboardState } from './logic.js';
import { WORDS } from './words/index.js';
import { resolveLocale, t } from './i18n.js';
import { renderView } from './view.js';

const root = document.getElementById('app');
const live = document.getElementById('live');
// Reading the storage object itself can throw in a restricted browser.
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let state = C.loadSession(storage);
let locale = resolveLocale(new URLSearchParams(location.search).get('lang'), navigator.languages || [navigator.language]);
let error = '', draft = {}, storageFailed = false, announcementTimer;
const T = (key, values) => t(locale, key, values);
function remember() { storageFailed = !C.saveSession(storage, state); }
function announce(message) {
  clearTimeout(announcementTimer);
  live.textContent = '';
  announcementTimer = setTimeout(() => { live.textContent = message; }, 30);
}
function render(focus = 'heading') {
  document.documentElement.lang = locale;
  document.documentElement.dataset.theme = state.settings.theme;
  document.title = T('title');
  root.innerHTML = renderView(state, locale, { error, draft, storageFailed });
  let target = document.getElementById(focus) || document.getElementById('heading');
  if (target?.disabled) target = root.querySelector('.key:not(:disabled)');
  target?.focus({ preventScroll: true });
}
function screenMessage() {
  if (state.screen === 'play') return T('turnReport', { turn: T(state.game.mode === 'duo' ? 'turnDuo' : 'turnSolo'), balloons: T('balloons', { n: remaining(state.game) }) });
  if (state.screen === 'end') {
    const won = status(state.game) === 'won';
    const winner = won ? state.game.mode === 'duo' ? 'duoWinner' : 'soloWinner' : state.game.mode === 'duo' ? 'setterWinner' : 'lost';
    return T('resultReport', { result: T(won ? 'won' : 'lost'), winner: T(winner), answerLabel: T('answer'), answer: state.game.entry.answer || state.game.entry.word });
  }
  return T({ home: 'title', setup: 'setupTitle', handoff: 'handoffTitle' }[state.screen]);
}
function start() {
  draft = {};
  if (state.mode === 'duo') state = C.beginDuo(state);
  else {
    const wl = C.wordLocale(state, locale);
    const next = C.startSolo(state, WORDS[wl], wl);
    if (!next) { error = 'emptyPool'; render('start-button'); announce(T(error)); return; }
    state = next;
  }
  remember(); render(); announce(screenMessage());
}
function play(action, value) {
  const previous = state;
  state = C.takeTurn(state, action, value);
  if (previous === state) return;
  remember();
  const key = state.game.guesses.at(-1);
  render(state.screen === 'end' ? 'heading' : action === 'hint' ? 'hint-button' : `key-${key}`);
  if (state.screen === 'end') announce(screenMessage());
  else {
    const balloons = T('balloons', { n: remaining(state.game) });
    const keyStatus = keyboardState(state.game).find(k => k.key === key).state;
    announce(action === 'hint' ? T('hintReport', { key, balloons }) : T('guessReport', { key, state: T(keyStatus), balloons }));
  }
}
function captureDraft() {
  if (state.screen === 'setup') draft = { word: root.querySelector('#secret')?.value || '', hint: root.querySelector('#secret-clue')?.value || '', show: Boolean(draft.show) };
}
root.addEventListener('change', event => {
  const name = event.target.dataset.setting;
  if (!name) return;
  captureDraft(); error = '';
  if (name === 'language') {
    locale = resolveLocale(event.target.value);
    const url = new URL(location.href);
    url.searchParams.set('lang', locale);
    try { history.replaceState(null, '', url); } catch { /* The current game still changes language. */ }
  } else state = C.settings(state, name, event.target.value);
  remember(); render(name); announce(screenMessage());
});
root.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  error = '';
  if (action === 'guess' || action === 'hint') { play(action, target.dataset.value); return; }
  if (action === 'show') {
    captureDraft(); draft.show = !draft.show;
    const input = root.querySelector('#secret');
    input.type = draft.show ? 'text' : 'password';
    target.textContent = T(draft.show ? 'hide' : 'show');
    target.setAttribute('aria-pressed', String(draft.show));
    return;
  }
  if (action === 'start' || action === 'again') { start(); return; }
  if (action === 'mode') { state = { ...state, mode: target.dataset.value }; remember(); render(); return; }
  if (action === 'ready') state = C.ready(state);
  if (action === 'resume') state = C.resume(state);
  if (action === 'home') { state = { ...state, screen: 'home' }; draft = {}; }
  if (action === 'new') { state = { ...state, screen: 'home', game: null, counted: false, clue: false }; draft = {}; }
  if (action === 'clue') state = { ...state, clue: !state.clue };
  remember(); render(); announce(screenMessage());
});
root.addEventListener('submit', event => {
  if (event.target.id !== 'secret-form') return;
  event.preventDefault(); captureDraft();
  try {
    state = C.setSecret(state, draft.word, draft.hint, C.wordLocale(state, locale));
    draft = {}; error = ''; remember(); render(); announce(screenMessage());
  } catch { error = 'invalidWord'; render('secret'); announce(T(error)); }
});
document.addEventListener('keydown', event => {
  if (state.screen !== 'play' || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target.closest('input,select,textarea')) return;
  const key = normalizeKey(event.key, state.game.locale);
  if (key) { event.preventDefault(); play('guess', key); }
});
remember(); render(); announce(screenMessage());

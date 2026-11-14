import { LOCALES } from './alphabet.js';
import { createGame, guess, letterHint, restoreGame, status } from './logic.js';
import { chooseWord } from './ai.js';

export const STORAGE_KEY = 'hangman:v1';
export const CATEGORIES = ['animals', 'food', 'nature', 'school', 'home', 'colors', 'transport', 'play'];
export const defaults = () => ({
  version: 1, screen: 'home', mode: 'solo', game: null, counted: false, clue: false, previous: '',
  settings: { theme: 'auto', wordLanguage: 'same', category: 'all', difficulty: 'any' },
  stats: { wins: 0, streak: 0, best: 0 },
});
export const wordLocale = (state, uiLocale) => state.settings.wordLanguage === 'same' ? uiLocale : state.settings.wordLanguage;
export function settings(state, name, value) {
  const choices = { theme: ['auto', 'light', 'dark'], wordLanguage: ['same', ...LOCALES], category: ['all', ...CATEGORIES], difficulty: ['any', 'easy', 'medium', 'hard'] };
  if (!Object.hasOwn(choices, name) || !choices[name].includes(value)) return state;
  return { ...state, settings: { ...state.settings, [name]: value } };
}
export function startSolo(state, words, locale, random = Math.random) {
  const entry = chooseWord(words, { ...state.settings, previous: state.previous }, random);
  if (!entry) return null;
  return { ...state, mode: 'solo', screen: 'play', game: createGame(entry, locale), counted: false, clue: false, previous: entry.word };
}
export function beginDuo(state) {
  return { ...state, mode: 'duo', screen: 'setup', game: null, counted: false, clue: false };
}
export function setSecret(state, word, hint, locale) {
  if (typeof hint !== 'string' || hint.length > 160) throw new Error('Invalid hint');
  const entry = { word, hint: hint.trim(), category: state.settings.category === 'all' ? 'custom' : state.settings.category };
  return { ...state, mode: 'duo', game: createGame(entry, locale, 'duo'), screen: 'handoff', clue: false, counted: false };
}
export function ready(state) {
  return state.screen === 'handoff' && state.game ? { ...state, screen: 'play' } : state;
}
export function takeTurn(state, action, value, random = Math.random) {
  if (state.screen !== 'play' || !state.game) return state;
  const game = action === 'hint' ? letterHint(state.game, random) : action === 'guess' ? guess(state.game, value) : state.game;
  if (game === state.game) return state;
  const next = { ...state, game };
  const outcome = status(game);
  if (outcome !== 'playing') {
    next.screen = 'end';
    if (!state.counted) {
      const wins = state.stats.wins + (outcome === 'won' ? 1 : 0);
      const streak = outcome === 'won' ? state.stats.streak + 1 : 0;
      next.stats = { wins, streak, best: Math.max(state.stats.best, streak) };
      next.counted = true;
    }
  }
  return next;
}
export function resume(state) {
  if (!state.game) return state;
  return { ...state, mode: state.game.mode, screen: status(state.game) === 'playing' ? state.game.mode === 'duo' ? 'handoff' : 'play' : 'end' };
}
export function restoreSession(raw) {
  let state = defaults();
  if (!raw || raw.version !== 1) return state;
  for (const [name, value] of Object.entries(raw.settings || {})) state = settings(state, name, value);
  if (['solo', 'duo'].includes(raw.mode)) state.mode = raw.mode;
  if (raw.stats && ['wins', 'streak', 'best'].every(k => Number.isSafeInteger(raw.stats[k]) && raw.stats[k] >= 0) && raw.stats.streak <= raw.stats.best && raw.stats.best <= raw.stats.wins) state.stats = { wins: raw.stats.wins, streak: raw.stats.streak, best: raw.stats.best };
  if (typeof raw.previous === 'string' && raw.previous.length <= 90) state.previous = raw.previous;
  try {
    if (raw.game) {
      const game = restoreGame(raw.game);
      if (![...CATEGORIES, 'custom'].includes(game.entry.category) || game.entry.hint.length > 160 || game.entry.answer.length > 80) throw new Error('Invalid entry');
      state.game = game;
      state.mode = game.mode;
      state.counted = Boolean(raw.counted);
      state.clue = Boolean(raw.clue);
      const outcome = status(game);
      // Completed state is counted in the same storage write as the last guess.
      if (outcome !== 'playing') state.counted = true;
      if (raw.screen === 'home') state.screen = 'home';
      else if (outcome !== 'playing') state.screen = 'end';
      else state.screen = game.mode === 'duo' ? 'handoff' : 'play';
    }
  } catch { /* A damaged game never prevents loading settings or the home screen. */ }
  return state;
}
export function loadSession(storage) {
  try { return restoreSession(JSON.parse(storage.getItem(STORAGE_KEY))); }
  catch { return defaults(); }
}
export function saveSession(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

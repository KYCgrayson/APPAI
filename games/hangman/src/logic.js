import { ALPHABETS, analyzeWord, normalizeKey, revealUnits } from './alphabet.js';
export const BALLOONS = 8;

export function createGame(entry, locale, mode = 'solo') {
  if (!entry || typeof entry.word !== 'string' || (entry.hint !== undefined && typeof entry.hint !== 'string') || (entry.answer !== undefined && typeof entry.answer !== 'string') || (entry.category !== undefined && typeof entry.category !== 'string')) throw new Error('Invalid entry');
  const { word } = analyzeWord(entry.word, locale);
  if (!['solo', 'duo'].includes(mode)) throw new Error('Invalid mode');
  return { locale, mode, entry: { word, category: entry.category || 'custom', hint: entry.hint || '', answer: entry.answer || '' }, guesses: [], hints: [], missed: 0 };
}
export function status(game) {
  const { required } = analyzeWord(game.entry.word, game.locale);
  if (required.every(k => game.guesses.includes(k))) return 'won';
  return remaining(game) === 0 ? 'lost' : 'playing';
}
export const remaining = game => Math.max(0, BALLOONS - game.missed - game.hints.length);
export function guess(game, value) {
  const key = normalizeKey(value, game.locale);
  if (status(game) !== 'playing' || !key || game.guesses.includes(key)) return game;
  const hit = analyzeWord(game.entry.word, game.locale).required.includes(key);
  return { ...game, guesses: [...game.guesses, key], missed: game.missed + (hit ? 0 : 1) };
}
export function letterHint(game, random = Math.random) {
  if (status(game) !== 'playing') return game;
  const choices = analyzeWord(game.entry.word, game.locale).required.filter(k => !game.guesses.includes(k));
  const sample = random();
  const i = Math.min(choices.length - 1, Math.max(0, Math.floor((Number.isFinite(sample) ? sample : 0) * choices.length)));
  const key = choices[i];
  return { ...game, guesses: [...game.guesses, key], hints: [...game.hints, key] };
}
export function keyboardState(game) {
  const required = analyzeWord(game.entry.word, game.locale).required;
  return ALPHABETS[game.locale].map(key => ({ key, state: !game.guesses.includes(key) ? 'unused' : game.hints.includes(key) ? 'hinted' : required.includes(key) ? 'hit' : 'miss' }));
}
export function visibleWord(game, revealAll = false) {
  return revealUnits(game.entry.word, game.locale, game.guesses, revealAll);
}
// Rebuild derived state rather than trusting a saved outcome or balloon count.
export function restoreGame(raw) {
  if (!raw || !Array.isArray(raw.guesses) || !Array.isArray(raw.hints)) throw new Error('Invalid save');
  const base = createGame(raw.entry, raw.locale, raw.mode);
  const { required } = analyzeWord(base.entry.word, base.locale);
  const guesses = raw.guesses;
  if (guesses.length > ALPHABETS[base.locale].length || new Set(guesses).size !== guesses.length || guesses.some(k => !ALPHABETS[base.locale].includes(k))) throw new Error('Invalid guesses');
  if (raw.hints.length > BALLOONS || new Set(raw.hints).size !== raw.hints.length || raw.hints.some(k => !guesses.includes(k) || !required.includes(k))) throw new Error('Invalid hints');
  const missed = guesses.filter(k => !required.includes(k)).length;
  if (missed + raw.hints.length > BALLOONS) throw new Error('Invalid balloons');
  return { ...base, guesses: [...guesses], hints: [...raw.hints], missed };
}

import { difficultyFor } from './alphabet.js';
// Each category owns explicit, original word/clue pairs. Optional third field is
// the Chinese/kanji answer, kept off the game screen until the result.
export function makeList(locale, groups) {
  return Object.entries(groups).flatMap(([category, rows]) => rows.trim().split('\n').map(row => {
    const [word, hint, answer = ''] = row.trim().split('|');
    return { word, hint, answer, category, difficulty: difficultyFor(word, locale) };
  }));
}

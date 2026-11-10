import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseWord } from '../src/ai.js';
import { WORDS } from '../src/words/index.js';
test('computer chooses only matching category and difficulty', () => {
  for (const words of Object.values(WORDS)) for (const entry of words) {
    const selected = chooseWord(words, { category: entry.category, difficulty: entry.difficulty }, () => .59);
    assert.equal(selected.category, entry.category);
    assert.equal(selected.difficulty, entry.difficulty);
  }
});
test('random boundaries are deterministic and every entry is reachable', () => {
  const words = WORDS.en;
  for (let i = 0; i < words.length; i++) assert.equal(chooseWord(words, {}, () => (i + .1) / words.length), words[i]);
  assert.equal(chooseWord(words, {}, () => -1), words[0]);
  assert.equal(chooseWord(words, {}, () => 1), words.at(-1));
  assert.equal(chooseWord(words, {}, () => NaN), words[0]);
});
test('avoid immediate repeats when another matching word exists', () => {
  const words = WORDS.en;
  assert.notEqual(chooseWord(words, { previous: words[0].word }, () => 0), words[0]);
  assert.equal(chooseWord([words[0]], { previous: words[0].word }), words[0]);
});
test('empty pools return null and never silently change the chosen filters', () => {
  assert.equal(chooseWord([]), null);
  assert.equal(chooseWord(WORDS.en, { category: 'not-a-category' }), null);
  assert.equal(chooseWord(WORDS.en, { category: 'colors', difficulty: 'hard' }), null);
});

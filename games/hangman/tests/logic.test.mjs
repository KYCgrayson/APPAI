import test from 'node:test';
import assert from 'node:assert/strict';
import { ALPHABETS, LOCALES, analyzeWord, normalizeKey, revealUnits, decomposeHangul, composeHangul, graphemes, difficultyFor } from '../src/alphabet.js';
import { BALLOONS, createGame, guess, letterHint, status, remaining, keyboardState, restoreGame } from '../src/logic.js';
import { WORDS } from '../src/words/index.js';

const game = (word, locale = 'en') => createGame({ word, category: 'custom' }, locale);
const open = (word, locale, keys) => revealUnits(word, locale, keys).filter(u => u.revealed).map(u => u.text).join('');
test('French accents and cedilla reveal on their base letters', () => {
  assert.equal(open('éèêë', 'fr', ['e']), 'éèêë');
  assert.equal(open('àâçôîïùûüÿ', 'fr', [...'acoiuy']), 'àâçôîïùûüÿ');
  assert.equal(normalizeKey('É', 'fr'), 'e');
  assert.equal(open('œuf', 'fr', ['o']), '');
  assert.equal(open('œuf', 'fr', ['o', 'e']), 'œ');
  assert.equal(open('cæcum', 'fr', ['a', 'e']), 'æ');
});
test('Spanish vowels fold but Ñ and N are separate', () => {
  assert.equal(open('áéíóúü', 'es', [...'aeiou']), 'áéíóúü');
  assert.equal(open('niño', 'es', ['n']), 'n');
  assert.equal(open('niño', 'es', ['ñ']), 'ñ');
  assert.equal(normalizeKey('N\u0303', 'es'), 'ñ');
});
test('German umlauts and sharp s use their own keys', () => {
  assert.equal(open('ÄÖÜß', 'de', [...'aous']), '');
  assert.equal(open('ÄÖÜß', 'de', [...'äöüß']), 'ÄÖÜß');
  assert.equal(normalizeKey('ẞ', 'de'), 'ß');
  assert.equal(ALPHABETS.de.includes('ß'), true);
});
test('English is case insensitive and preserves original writing', () => {
  assert.equal(open('Apple', 'en', ['a', 'p']), 'App');
  assert.equal(normalizeKey('A', 'en'), 'a');
});
test('Traditional Chinese uses exactly 37 symbols; tone marks are free', () => {
  assert.equal(ALPHABETS['zh-TW'].length, 37);
  assert.equal(open('ㄊㄨˋ ˙ㄗ', 'zh-TW', []), 'ˋ ˙');
  assert.equal(open('ㄊㄨˋ ˙ㄗ', 'zh-TW', ['ㄊ', 'ㄨ', 'ㄗ']), 'ㄊㄨˋ ˙ㄗ');
  assert.equal(normalizeKey('ˋ', 'zh-TW'), null);
  assert.throws(() => analyzeWord('兔子', 'zh-TW'));
});
test('Simplified Chinese uses toneless pinyin, with v for ü', () => {
  assert.deepEqual(analyzeWord('lvse', 'zh-CN').required, [...'lvse']);
  assert.deepEqual(analyzeWord('lǜsè', 'zh-CN').required, [...'lvse']);
  assert.equal(normalizeKey('Ü', 'zh-CN'), 'v');
  assert.equal(open('LVSE', 'zh-CN', ['l', 'v']), 'LV');
  assert.throws(() => analyzeWord('绿色', 'zh-CN'));
});
test('Japanese small kana, dakuten and handakuten share the base key', () => {
  assert.equal(open('がぎぐげご', 'ja', [...'かきくけこ']), 'がぎぐげご');
  assert.equal(open('ぱぴぷぺぽ', 'ja', [...'はひふへほ']), 'ぱぴぷぺぽ');
  assert.equal(open('ゃゅょっぁぃぅぇぉ', 'ja', [...'やゆよつあいうえお']), 'ゃゅょっぁぃぅぇぉ');
  assert.equal(open('ちーず', 'ja', []), 'ー');
  assert.equal(normalizeKey('が', 'ja'), 'か');
  assert.throws(() => analyzeWord('カタカナ', 'ja'));
});
test('all 11,172 Hangul syllables decompose and compose without loss', () => {
  for (let n = 0xac00; n <= 0xd7a3; n++) {
    const char = String.fromCodePoint(n);
    assert.equal(composeHangul(...decomposeHangul(char)), char);
  }
  assert.equal(decomposeHangul('a'), null);
  assert.equal(decomposeHangul('가나'), null);
  assert.throws(() => composeHangul('?', 'ㅏ'));
});
test('Korean blocks open only after all jamo; doubles and compounds expand', () => {
  assert.equal(open('강', 'ko', ['ㄱ', 'ㅏ']), '');
  assert.equal(open('강', 'ko', ['ㄱ', 'ㅏ', 'ㅇ']), '강');
  assert.deepEqual(analyzeWord('꽥', 'ko').required, ['ㄱ', 'ㅗ', 'ㅏ', 'ㅣ']);
  assert.deepEqual(analyzeWord('값', 'ko').required, ['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ']);
  assert.equal(normalizeKey('ㄲ', 'ko'), 'ㄱ');
  assert.equal(open('꽥', 'ko', ['ㄱ', 'ㅗ', 'ㅏ', 'ㅣ']), '꽥');
});
test('Hindi matras open with vowels and whole graphemes stay intact', () => {
  assert.deepEqual(analyzeWord('कि', 'hi').required, ['क', 'इ']);
  assert.equal(open('कि', 'hi', ['क']), '');
  assert.equal(open('कि', 'hi', ['क', 'इ']), 'कि');
  assert.equal(open('काँ', 'hi', ['क', 'आ']), 'काँ');
  assert.equal(open('फ़', 'hi', ['फ']), 'फ़');
  assert.equal(open('वृक्ष', 'hi', ['व', 'ऋ']), 'वृ');
  assert.equal(open('वृक्ष', 'hi', ['व', 'ऋ', 'क', 'ष']), 'वृक्ष');
  assert.equal(open('स्त्री', 'hi', ['स', 'त', 'र']), '');
  assert.equal(open('स्त्री', 'hi', ['स', 'त', 'र', 'ई']), 'स्त्री');
  assert.equal(open('कॉपी', 'hi', ['क', 'ऑ']), 'कॉ');
  assert.equal(graphemes('स्त्री', 'hi').length, 1);
  assert.throws(() => analyzeWord('िक', 'hi'));
});
test('invalid secrets and keys are rejected without changing the game', () => {
  for (const word of ['', '  ', '123', '<script>', 'a'.repeat(33), '😀', 'a\n<script>']) assert.throws(() => game(word));
  assert.throws(() => game('word', 'xx'));
  assert.throws(() => createGame({ word: 'cat' }, 'en', 'online'));
  for (const key of ['Enter', 'ArrowLeft', '12', '<', '', null]) assert.equal(guess(game('cat'), key).guesses.length, 0);
  assert.throws(() => analyzeWord('ं', 'hi'));
});
test('spaces and hyphens stay visible and do not need guesses', () => {
  assert.equal(open('arc-en-ciel', 'fr', []), '--');
  assert.equal(open('globo terráqueo', 'es', []), ' ');
});
test('hits, repeated keys, hints and keyboard symbols agree', () => {
  const start = game('banana');
  const a = guess(start, 'A');
  assert.equal(remaining(a), BALLOONS);
  assert.equal(open('banana', 'en', a.guesses), 'aaa');
  assert.equal(guess(a, 'á'), a);
  const wrong = guess(a, 'x');
  assert.equal(remaining(wrong), BALLOONS - 1);
  assert.equal(guess(wrong, 'X'), wrong);
  const hint = letterHint(wrong, () => 0);
  assert.equal(hint.hints[0], 'b');
  assert.equal(remaining(hint), BALLOONS - 2);
  const keys = Object.fromEntries(keyboardState(hint).map(k => [k.key, k.state]));
  assert.equal(keys.a, 'hit'); assert.equal(keys.x, 'miss'); assert.equal(keys.b, 'hinted'); assert.equal(keys.n, 'unused');
  assert.deepEqual(start.guesses, []);
});
test('eight misses land the basket and lock all further guesses', () => {
  let g = game('a');
  for (const key of 'bcdefghi') g = guess(g, key);
  assert.equal(status(g), 'lost'); assert.equal(remaining(g), 0);
  assert.equal(guess(g, 'a'), g); assert.equal(letterHint(g), g);
});
test('a last-balloon hint can win; an unfinished hint can land', () => {
  let a = game('a'), ab = game('ab');
  for (const key of 'cdefghi') { a = guess(a, key); ab = guess(ab, key); }
  assert.equal(status(letterHint(a, () => 0)), 'won');
  assert.equal(status(letterHint(ab, () => 0)), 'lost');
  const won = guess(game('a'), 'a');
  assert.equal(guess(won, 'b'), won); assert.equal(letterHint(won), won);
});
test('saved games are checked and counts are recalculated', () => {
  const saved = letterHint(guess(game('cat'), 'x'), () => 0);
  assert.deepEqual(restoreGame({ ...saved, missed: 999, status: 'won' }), saved);
  for (const raw of [null, {}, { ...saved, guesses: ['x', 'x'] }, { ...saved, guesses: ['<'] }, { ...saved, hints: ['z'] }, { ...saved, hints: ['c', 'c'] }, { ...game('a'), guesses: [...'bcdefghij'] }]) assert.throws(() => restoreGame(raw));
});
for (const locale of LOCALES) {
  test(`${locale}: all 150 words have unique spelling, valid alphabet, clue, category and length`, () => {
    const words = WORDS[locale];
    assert.ok(words.length >= 150);
    const canonical = words.map(w => w.word.normalize('NFC').toLowerCase().replace(/[ '\-’]/g, ''));
    assert.equal(new Set(canonical).size, words.length);
    for (const entry of words) {
      const analysis = analyzeWord(entry.word, locale);
      assert.ok(analysis.required.length);
      assert.ok(analysis.required.every(key => ALPHABETS[locale].includes(key)));
      assert.ok(entry.hint.trim().length >= 4);
      assert.ok(['animals','food','nature','school','home','colors','transport','play'].includes(entry.category));
      assert.equal(entry.difficulty, difficultyFor(entry.word, locale));
      if (locale.startsWith('zh')) assert.match(entry.answer, /\p{Script=Han}/u);
      if (locale === 'hi') assert.match(entry.word, /\p{Script=Devanagari}/u);
    }
    assert.deepEqual(new Set(words.map(w => w.difficulty)), new Set(['easy', 'medium', 'hard']));
  });
  test(`${locale}: every dictionary word can be solved with its keyboard and resumed`, () => {
    for (const entry of WORDS[locale]) {
      let g = createGame(entry, locale);
      for (const key of analyzeWord(entry.word, locale).required) g = guess(g, key);
      assert.equal(status(g), 'won', entry.word);
      assert.equal(remaining(g), BALLOONS);
      assert.equal(revealUnits(entry.word, locale, g.guesses).map(u => u.revealed ? u.text : '?').join(''), entry.word);
      assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(g))), g);
    }
  });
  test(`${locale}: misses, paid hints and a loss use the same canonical alphabet`, () => {
    let g = createGame(WORDS[locale][0], locale);
    const required = analyzeWord(g.entry.word, locale).required;
    const hinted = letterHint(g, () => .5);
    assert.ok(required.includes(hinted.hints[0]));
    assert.equal(remaining(hinted), BALLOONS - 1);
    for (const key of ALPHABETS[locale].filter(k => !required.includes(k)).slice(0, BALLOONS)) g = guess(g, key);
    assert.equal(status(g), 'lost');
    assert.equal(remaining(g), 0);
    assert.equal(keyboardState(g).filter(k => k.state === 'miss').length, BALLOONS);
    assert.deepEqual(restoreGame(g), g);
  });
}

// All matching and segmentation is shared by the picker, secret input and rules.
export const LOCALES = ['en', 'es', 'zh-TW', 'zh-CN', 'ja', 'ko', 'de', 'fr', 'hi'];
const latin = 'abcdefghijklmnopqrstuvwxyz';
export const ALPHABETS = {
  en: [...latin], es: [...'abcdefghijklmnñopqrstuvwxyz'],
  'zh-TW': [...'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦㄧㄨㄩ'],
  'zh-CN': [...latin], ja: [...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'],
  ko: [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ'],
  de: [...latin, 'ä', 'ö', 'ü', 'ß'], fr: [...latin],
  hi: [...'अआइईउऊऋएऐओऔऑकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह'],
};
const INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const VOWELS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
const JAMO = {
  ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ', ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ',
  ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ',
  ㅐ: 'ㅏㅣ', ㅒ: 'ㅑㅣ', ㅔ: 'ㅓㅣ', ㅖ: 'ㅕㅣ', ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅏㅣ',
  ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅓㅣ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ',
};
const MATRAS = { 'ा': 'आ', 'ि': 'इ', 'ी': 'ई', 'ु': 'उ', 'ू': 'ऊ', 'ृ': 'ऋ', 'े': 'ए', 'ै': 'ऐ', 'ो': 'ओ', 'ौ': 'औ', 'ॉ': 'ऑ' };
const SMALL_KANA = { ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', っ: 'つ', ゎ: 'わ', ゕ: 'か', ゖ: 'け' };
const segmenters = new Map();

export function graphemes(text, locale = 'en') {
  if (!segmenters.has(locale)) segmenters.set(locale, new Intl.Segmenter(locale, { granularity: 'grapheme' }));
  return [...segmenters.get(locale).segment(text.normalize('NFC'))].map(s => s.segment);
}
export function decomposeHangul(char) {
  const n = char.codePointAt(0) - 0xac00;
  if (n < 0 || n >= 11172 || [...char].length !== 1) return null;
  return [INITIALS[Math.floor(n / 588)], VOWELS[Math.floor(n / 28) % 21], FINALS[n % 28]];
}
export function composeHangul(initial, vowel, final = '') {
  const l = INITIALS.indexOf(initial), v = VOWELS.indexOf(vowel), t = FINALS.indexOf(final);
  if (l < 0 || v < 0 || t < 0) throw new Error('Invalid jamo');
  return String.fromCodePoint(0xac00 + l * 588 + v * 28 + t);
}

function keysFor(text, locale) {
  const lower = text.toLowerCase();
  if (['en', 'es', 'fr', 'de', 'zh-CN'].includes(locale)) {
    if (locale === 'zh-CN' && lower.normalize('NFD').startsWith('u\u0308')) return ['v'];
    if (locale === 'de' && ['ä', 'ö', 'ü', 'ß'].includes(lower)) return [lower];
    if (locale === 'es' && lower === 'ñ') return ['ñ'];
    // French ligatures need both letters. Pinyin ü is written v.
    if (locale === 'fr' && lower === 'œ') return ['o', 'e'];
    if (locale === 'fr' && lower === 'æ') return ['a', 'e'];
    if (!/^\p{Script=Latin}\p{Mark}*$/u.test(lower)) return null;
    const base = lower.normalize('NFD').replace(/\p{Mark}/gu, '');
    return ALPHABETS[locale].includes(base) ? [base] : null;
  }
  if (locale === 'zh-TW') {
    if (ALPHABETS[locale].includes(text)) return [text];
    return /^[ˊˇˋ˙]$/.test(text) ? [] : null;
  }
  if (locale === 'ja') {
    if (text === 'ー') return [];
    const base = text.normalize('NFD').replace(/[\u3099\u309a]/g, '');
    const key = SMALL_KANA[base] || base;
    return ALPHABETS.ja.includes(key) ? [key] : null;
  }
  if (locale === 'ko') {
    const parts = decomposeHangul(text);
    const raw = parts ? parts.join('') : text;
    const keys = [...raw].flatMap(j => [...(JAMO[j] || j)]);
    return keys.every(k => ALPHABETS.ko.includes(k)) ? [...new Set(keys)] : null;
  }
  if (locale === 'hi') {
    if (!ALPHABETS.hi.includes([...text.normalize('NFD')][0])) return null;
    const keys = [];
    for (const c of text.normalize('NFD')) {
      if (ALPHABETS.hi.includes(c)) keys.push(c);
      else if (MATRAS[c]) keys.push(MATRAS[c]);
      else if (!/[ंँः़्]/u.test(c)) return null;
    }
    return [...new Set(keys)];
  }
  return null;
}

export function analyzeWord(word, locale) {
  if (!LOCALES.includes(locale) || typeof word !== 'string') throw new Error('Invalid word');
  const clean = word.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!clean || [...clean].length > 90) throw new Error('Invalid word length');
  const units = graphemes(clean, locale).map(text => {
    const keys = /^[ '\-’]$/.test(text) ? [] : keysFor(text, locale);
    if (keys === null) throw new Error('Unsupported character');
    return { text, keys };
  });
  const required = [...new Set(units.flatMap(u => u.keys))];
  if (!required.length || units.filter(u => u.keys.length).length > 32) throw new Error('Invalid word length');
  return { word: clean, units, required };
}
export function normalizeKey(value, locale) {
  if (typeof value !== 'string' || !LOCALES.includes(locale)) return null;
  const keys = keysFor(value.normalize('NFC'), locale);
  return keys?.length === 1 ? keys[0] : null;
}
export function revealUnits(word, locale, guessed, revealAll = false) {
  return analyzeWord(word, locale).units.map(u => ({
    ...u, revealed: revealAll || u.keys.every(k => guessed.includes(k)),
  }));
}
export function difficultyFor(word, locale) {
  const n = analyzeWord(word, locale).units.filter(u => u.keys.length).length;
  const [easy, medium] = ['ja', 'ko', 'hi'].includes(locale) ? [2, 3] : locale.startsWith('zh') ? [4, 6] : [4, 7];
  return n <= easy ? 'easy' : n <= medium ? 'medium' : 'hard';
}

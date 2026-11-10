import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, STRINGS, detectLanguage, translate } from '../src/i18n.js';

for (const locale of LOCALES) test(`${locale}: complete nonempty translations and matching placeholders`, () => {
  assert.deepEqual(Object.keys(STRINGS[locale]).sort(), Object.keys(STRINGS.en).sort());
  for (const [key, text] of Object.entries(STRINGS[locale])) {
    const reference = STRINGS.en[key].other ?? STRINGS.en[key];
    if (typeof text !== 'string') assert.deepEqual(Object.keys(text).sort(), ['one', 'other'], key);
    for (const form of typeof text === 'string' ? [text] : Object.values(text)) {
      assert.equal(typeof form, 'string'); assert.ok(form.trim(), key);
      assert.deepEqual((form.match(/\{\w+\}/g) ?? []).sort(), (reference.match(/\{\w+\}/g) ?? []).sort(), key);
    }
  }
});
test('stone counts use locale plural rules, including French and Hindi zero', () => {
  const expected = {
    en: ['0 stones placed', '1 stone placed', '2 stones placed'],
    es: ['0 fichas colocadas', '1 ficha colocada', '2 fichas colocadas'],
    de: ['0 Steine gesetzt', '1 Stein gesetzt', '2 Steine gesetzt'],
    fr: ['0 pierre posée', '1 pierre posée', '2 pierres posées'],
    hi: ['0 गोटी रखी गई', '1 गोटी रखी गई', '2 गोटियाँ रखी गईं'],
  };
  for (const [locale, forms] of Object.entries(expected)) {
    for (const [count, text] of forms.entries()) assert.equal(translate(locale, 'moveCount', { count }), text);
  }
  // Categories beyond one fall back to the supplied other form.
  for (const locale of ['es', 'fr']) {
    assert.equal(translate(locale, 'moveCount', { count: 1_000_000 }), STRINGS[locale].moveCount.other.replace('{count}', '1000000'));
  }
});
test('Chinese, Japanese and Korean stone counts retain a single form', () => {
  for (const locale of ['zh-TW', 'zh-CN', 'ja', 'ko']) {
    assert.equal(typeof STRINGS[locale].moveCount, 'string');
    for (const count of [0, 1, 2, 225]) {
      assert.equal(translate(locale, 'moveCount', { count }), STRINGS[locale].moveCount.replace('{count}', count));
    }
  }
});
test('query locale overrides navigator and all supported codes match', () => {
  for (const locale of LOCALES) assert.equal(detectLanguage(locale, ['fr']), locale);
  assert.equal(detectLanguage('ES-mx', ['ja']), 'es');
  assert.equal(detectLanguage(null, ['unknown', 'de-AT']), 'de');
  assert.equal(detectLanguage(null, ['es-MX', 'fr']), 'fr');
  assert.equal(detectLanguage('unknown', ['ko-KR']), 'ko');
  assert.equal(detectLanguage(null, ['xx']), 'en');
  assert.equal(detectLanguage(null, []), 'en');
});
test('Chinese script and regional aliases choose the right writing system', () => {
  for (const tag of ['zh-Hant', 'zh-Hant-HK', 'zh-HK', 'zh-MO', 'zh-TW']) assert.equal(detectLanguage(tag), 'zh-TW');
  for (const tag of ['zh', 'zh-Hans', 'zh-SG', 'zh-CN', 'zh-Hans-CN']) assert.equal(detectLanguage(null, [tag]), 'zh-CN');
});
test('Hindi is Devanagari and templates substitute localized values', () => {
  assert.match(STRINGS.hi.title, /[\u0900-\u097f]/);
  assert.equal(translate('zh-TW', 'turn', { player: STRINGS['zh-TW'].black }), '輪到黑棋 ●');
  for (const locale of LOCALES) assert.ok(!translate(locale, 'coordinate', { row: 2, col: 3, cell: STRINGS[locale].empty }).includes('{'));
});

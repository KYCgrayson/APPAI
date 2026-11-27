import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, LANGUAGES, matchLocale, detectLocale, translate } from '../src/i18n.js';

test('exactly the nine required locales are supplied', () => {
  assert.deepEqual(Object.keys(STRINGS).sort(), ['en', 'es', 'zh-TW', 'zh-CN', 'ja', 'ko', 'de', 'fr', 'hi'].sort());
  assert.deepEqual(Object.keys(STRINGS), Object.keys(LANGUAGES));
});
for (const locale of Object.keys(LANGUAGES)) {
  test(`${locale}: complete, nonempty translations with matching placeholders`, () => {
    assert.deepEqual(Object.keys(STRINGS[locale]).sort(), Object.keys(STRINGS.en).sort());
    for (const [key, value] of Object.entries(STRINGS[locale])) {
      assert.equal(typeof value, 'string', key);
      assert.ok(value.trim().length, key);
      const placeholders = text => (text.match(/\{\w+\}/g) || []).sort();
      assert.deepEqual(placeholders(value), placeholders(STRINGS.en[key]), key);
      assert.ok(!translate(locale, key, { n: 3, total: 5, coord: 'A1', player: 'X', result: 'Y' }).includes('{'), key);
    }
  });
}
test('Hindi uses Devanagari for every piece of UI copy', () => {
  for (const text of Object.values(STRINGS.hi)) assert.match(text, /[\u0900-\u097f]/);
});
test('Chinese script and region variants resolve correctly', () => {
  for (const lang of ['zh-TW', 'zh-Hant', 'zh-Hant-TW', 'zh-HK', 'zh-MO', 'ZH_hk']) assert.equal(matchLocale(lang), 'zh-TW', lang);
  for (const lang of ['zh', 'zh-CN', 'zh-Hans', 'zh-SG']) assert.equal(matchLocale(lang), 'zh-CN', lang);
});
test('language query overrides browser preference; primary language and default work', () => {
  assert.equal(detectLocale('de', ['ja-JP']), 'de');
  assert.equal(detectLocale('es-MX', ['en']), 'es');
  assert.equal(detectLocale(null, ['pt-BR', 'ko-KR']), 'ko');
  assert.equal(detectLocale('unknown', ['fr-CA']), 'fr');
  assert.equal(detectLocale(null, ['xx']), 'en');
  assert.equal(detectLocale(null), 'en');
});

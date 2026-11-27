import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES } from '../src/alphabet.js';
import { STRINGS, NAMES, matchLocale, resolveLocale, t } from '../src/i18n.js';
for (const locale of LOCALES) test(`${locale}: exactly the English keys, no empty values, matching placeholders`, () => {
  assert.deepEqual(Object.keys(STRINGS[locale]).sort(), Object.keys(STRINGS.en).sort());
  assert.ok(NAMES[locale]);
  for (const [key, value] of Object.entries(STRINGS[locale])) {
    assert.equal(typeof value, 'string'); assert.ok(value.trim());
    assert.deepEqual([...value.matchAll(/\{\w+\}/g)].map(m => m[0]).sort(), [...STRINGS.en[key].matchAll(/\{\w+\}/g)].map(m => m[0]).sort(), key);
  }
});
test('query locale wins and browser languages are considered in order', () => {
  assert.equal(resolveLocale('de', ['ja']), 'de');
  assert.equal(resolveLocale('xx', ['it-IT', 'es-MX', 'en']), 'es');
  assert.equal(resolveLocale(null, ['fr-CA', 'de']), 'fr');
  assert.equal(resolveLocale('KO-kr', ['en']), 'ko');
  assert.equal(resolveLocale(null, ['unknown']), 'en');
  assert.equal(resolveLocale(null, []), 'en');
});
test('Chinese variants resolve by script or region', () => {
  for (const code of ['zh-TW','zh-Hant','zh-Hant-HK','zh-HK','zh-MO','ZH_hk']) assert.equal(matchLocale(code), 'zh-TW');
  for (const code of ['zh','zh-CN','zh-Hans','zh-SG','zh-Hans-CN']) assert.equal(matchLocale(code), 'zh-CN');
});
test('formatter fills values without English fallback', () => {
  assert.equal(t('fr', 'balloons', { n: 3 }), 'Il reste 3 ballons sur 8');
  assert.throws(() => t('fr', 'missing'));
  assert.match(STRINGS.hi.title, /\p{Script=Devanagari}/u);
  assert.equal(STRINGS['zh-TW'].title, '猜單字（Hangman）');
});

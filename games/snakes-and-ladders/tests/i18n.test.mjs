import test from 'node:test';
import assert from 'node:assert/strict';
import { languages, messages, chooseLanguage, matchLanguage, translate, keys } from '../src/i18n.js';
for (const locale of Object.keys(languages)) test(`${locale}: complete nonempty messages and matching placeholders`, () => {
  assert.deepEqual(Object.keys(messages[locale]).sort(), Object.keys(messages.en).sort());
  assert.equal(Object.keys(messages[locale]).length, keys.length);
  for (const key of keys) {
    assert.equal(typeof messages[locale][key], 'string'); assert.ok(messages[locale][key].trim());
    assert.deepEqual(messages[locale][key].match(/\{\w+\}/g)?.sort() ?? [], messages.en[key].match(/\{\w+\}/g)?.sort() ?? [], key);
  }
  // These are also ordinary German words, rather than fallback translations.
  if (locale !== 'en') for (const key of keys) if (!(locale === 'de' && ['computer', 'offBoard'].includes(key))) assert.notEqual(messages[locale][key], messages.en[key], key);
});
test('language selection handles query, exact tags, primary tags, Chinese scripts and default', () => {
  for (const tag of ['zh-Hant', 'zh-HK', 'zh-MO', 'zh-TW', 'zh-Hant-HK']) assert.equal(matchLanguage(tag), 'zh-TW');
  for (const tag of ['zh', 'zh-Hans', 'zh-SG', 'zh-CN']) assert.equal(matchLanguage(tag), 'zh-CN');
  assert.equal(chooseLanguage('ja', ['es']), 'ja'); assert.equal(chooseLanguage(null, ['xx', 'fr-CA']), 'fr');
  assert.equal(chooseLanguage('xx', ['de-DE']), 'de'); assert.equal(chooseLanguage(null, ['xx']), 'en');
  assert.equal(chooseLanguage(null, ['ko-KR', 'en']), 'ko'); assert.equal(matchLanguage('EN_us'), 'en');
});
test('Hindi uses Devanagari and interpolation never falls back', () => {
  assert.match(messages.hi.title, /[\u0900-\u097f]/); assert.equal(translate('es', 'player', { n: 2 }), 'Jugador 2');
  assert.throws(() => translate('es', 'missing')); assert.throws(() => translate('xx', 'title'));
});

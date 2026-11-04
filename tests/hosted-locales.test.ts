import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidLocale, SUPPORTED_LOCALES } from '../src/lib/validations/page.ts';

test('hosted URL locales retain regex-valid locales beyond the suggested list', () => {
  for (const locale of SUPPORTED_LOCALES) assert.equal(isValidLocale(locale), true);
  for (const locale of ['zh-HK', 'es-MX', 'en-US', 'ai']) assert.equal(isValidLocale(locale), true);
  for (const slug of ['eng', 'en-us', 'sample-notes', '']) {
    assert.equal(isValidLocale(slug), false);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeJsonLd } from '../src/lib/json-ld.ts';
test('structured data cannot break out of script and preserves publisher strings', () => {
  const attack = '</script><script>alert(1)</script>&>\u2028\u2029';
  const value = { title: attack, name: attack, description: attack };
  const serialized = serializeJsonLd(value);
  assert.deepEqual(JSON.parse(serialized), value);
  for (const character of ['<', '>', '&', '\u2028', '\u2029']) assert.equal(serialized.includes(character), false);
});

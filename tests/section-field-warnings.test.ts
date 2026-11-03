import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionFieldWarnings } from '../src/lib/section-field-warnings.ts';
test('warns only for unused section data keys', () => {
  const warnings = sectionFieldWarnings([{ type: 'screenshots', data: { images: [], heading: 'Images', id: 'shots', backgroundColor: '#ffffff', foo: true } }, { type: 'custom', data: { foo: true } }]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /unknown field "foo" in screenshots; known fields:.*images/);
});

test('warns once per screenshots section for strings and objects without kind', () => {
  const warnings = sectionFieldWarnings([{ type: 'screenshots', data: { images: ['https://example.com/a.png', { url: 'https://example.com/b.png' }] } }]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /set kind.*width\/height/);
  assert.deepEqual(sectionFieldWarnings([{ type: 'screenshots', data: { images: [{ url: 'https://example.com/a.png', kind: 'web' }] } }]), []);
});

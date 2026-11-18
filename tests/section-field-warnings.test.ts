import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionFieldWarnings } from '../src/lib/section-field-warnings.ts';
import { pageHeadingWarnings } from '../src/lib/section-field-warnings.ts';
import { checkPagePreview } from '../src/lib/page-preview.ts';
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

test('H1 warnings follow hero, profile, legacy and public access rendering', () => {
  for (const content of [{}, { sections: [] }, { sections: [null] }, { sections: [{ type: 'hero', data: {} }] }, { sections: [{ type: 'profile-header', data: { name: 'Jordan' } }] }]) {
    assert.deepEqual(pageHeadingWarnings(content), []);
  }
  for (const section of [
    { type: 'features', data: { items: [] } },
    { type: 'profile-header', data: { name: '   ' } },
    { type: 'hero', data: { access: 'login' } },
    { type: 'about', data: { text: '# Markdown heading becomes H3' } },
  ]) assert.match(pageHeadingWarnings({ sections: [section] })[0].message, /renders 0 H1/);
  assert.match(pageHeadingWarnings({ sections: [{ type: 'hero' }, { type: 'hero' }, { type: 'profile-header', data: { name: 'Jordan' } }] })[0].message, /renders 3 H1/);
});

test('dry-run warns without blocking or altering content for missing and duplicate H1s', () => {
  for (const [sections, count] of [
    [[{ type: 'features', data: { items: [] } }], 0],
    [[{ type: 'hero', data: { headline: 'One' } }, { type: 'hero', data: { headline: 'Two' } }], 2],
  ] as const) {
    const body = { slug: 'example', title: 'Example', content: { sections } };
    const before = JSON.stringify(body);
    const preview = checkPagePreview(body);
    assert.equal(preview.valid, true);
    assert.deepEqual(preview.errors, []);
    assert.equal(JSON.stringify(body), before);
    assert.ok(preview.warnings.some(warning => warning.path === 'content.sections' && warning.message.includes(`renders ${count} H1`)));
  }
});

test('hero media warnings explain variant precedence and blocked sources without warning on HTTPS thumbnails', async () => {
  const { heroMediaWarnings } = await import('../src/lib/hero-media.ts');
  const image = 'https://i.ytimg.com/vi/fixture/maxresdefault.jpg';
  const warn = (data: Record<string, unknown>) => heroMediaWarnings({ sections: [{ type: 'hero', data }] });
  for (const variant of [undefined, 'centered', 'split']) assert.deepEqual(warn({ variant, backgroundImage: image }), []);
  assert.match(warn({ variant: 'minimal', backgroundImage: image })[0].message, /minimal.*ignores backgroundImage/);
  assert.match(warn({ variant: 'split', backgroundVideo: 'https://example.com/video.mp4' })[0].message, /split.*ignores backgroundVideo/);
  assert.match(warn({ backgroundImage: image, backgroundVideo: 'https://example.com/video.mp4' })[0].message, /takes precedence/);
  for (const backgroundImage of ['http://example.com/bg.jpg', 'https://', 'https://not a url', false, 0]) assert.match(warn({ backgroundImage })[0].message, /CSP/);
  assert.match(warn({ imageUrl: image })[0].message, /use data.backgroundImage/);
});

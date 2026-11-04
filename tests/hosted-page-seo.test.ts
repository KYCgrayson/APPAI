import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJsonLd, hostedOgImage } from '../src/lib/hosted-page-seo.ts';
const base = 'https://example.com';
test('PERSON uses profile entity and safe optional fields', () => {
  const page = { template: 'PERSON', title: 'Jordan', locale: 'ja', content: { sections: [{ type: 'profile-header', data: { name: 'Jordan', intro: ' **Hello** ', avatar: { url: 'https://example.com/avatar.png' }, links: [{ url: 'https://example.org' }, { url: 'javascript:evil' }] } }] } };
  const primary = buildJsonLd(page, base, base, null)['@graph'][0];
  assert.equal(primary['@type'], 'ProfilePage');
  assert.equal(primary.mainEntity.description, 'Hello');
  assert.deepEqual(primary.mainEntity.sameAs, ['https://example.org/']);
  assert.equal(hostedOgImage(page), 'https://example.com/avatar.png');
  for (const invalid of [
    { ...page, parentSlug: 'mira' },
    { ...page, content: {} },
    { ...page, content: { sections: [{ type: 'profile-header', data: { name: '   ' } }] } },
  ]) {
    const primary = buildJsonLd(invalid, base, base, null)['@graph'][0];
    assert.equal(primary['@type'], 'WebPage');
    assert.equal(primary.mainEntity, undefined);
  }
});
test('non-PERSON keeps WebPage and SoftwareApplication behavior', () => {
  assert.equal(buildJsonLd({ content: {} }, base, base, null)['@graph'][0]['@type'], 'WebPage');
  assert.equal(buildJsonLd({ content: { sections: [{ type: 'download', data: { appStoreUrl: base } }] } }, base, base, null)['@graph'][0]['@type'], 'SoftwareApplication');
});
test('ItemList resolves hosted links and drops unsafe URLs', () => {
  const result = buildJsonLd({ content: { sections: [{ type: 'project-cards', data: { items: [{ name: 'Tool', links: [{ url: '/p/jordan/tool' }] }, { name: 'Bad', links: [{ url: 'javascript:bad' }] }] } }] } }, base, base, null);
  assert.equal(result['@graph'][1].itemListElement[0].url, `${base}/p/jordan/tool`);
  assert.equal(result['@graph'][1].itemListElement.length, 1);
});
test('og image falls through unsafe values in the documented order', () => {
  const page = { ogImage: 'javascript:evil', heroImage: 'data:image/png,bad', content: { sections: [
    { type: 'profile-header', data: { avatar: { url: 'https://example.com/avatar.png' } } },
    { type: 'project-cards', data: { items: [{ screenshot: { url: 'https://example.com/project.png' } }] } },
    { type: 'screenshots', data: { images: ['https://example.com/screen.png'] } },
  ] } };
  assert.equal(hostedOgImage(page), 'https://example.com/avatar.png');
  page.content.sections.shift();
  assert.equal(hostedOgImage(page), 'https://example.com/project.png');
  page.content.sections.shift();
  assert.equal(hostedOgImage(page), 'https://example.com/screen.png');
});

test('PERSON children and unnamed roots with downloads remain SoftwareApplication', () => {
  for (const parentSlug of [null, 'mira']) {
    const primary = buildJsonLd({ template: 'PERSON', parentSlug, content: { sections: [
      { type: 'profile-header', data: { name: parentSlug ? 'Tidepool' : '' } },
      { type: 'download', data: { appStoreUrl: base } },
    ] } }, base, base, null)['@graph'][0];
    assert.equal(primary['@type'], 'SoftwareApplication');
    assert.equal(primary.mainEntity, undefined);
    assert.equal(primary.operatingSystem, 'iOS');
  }
});

test('hosted graphs reference the platform nodes on non-production origins', () => {
  const primary = buildJsonLd({ content: {} }, 'http://localhost:3000/p/test', 'http://localhost:3000', null)['@graph'][0];
  assert.deepEqual(primary.publisher, { '@id': 'https://appai.info/#org' });
  assert.deepEqual(primary.isPartOf, { '@id': 'https://appai.info/#website' });
});

test('OG falls back to the first project item that has a usable screenshot or icon', () => {
  assert.equal(hostedOgImage({ content: { sections: [{ type: 'project-cards', data: { items: [
    { name: 'Text only' }, { name: 'Icon', icon: { url: 'https://example.com/icon.png' } }, { name: 'Screen', screenshot: { url: 'https://example.com/screen.png' } },
  ] } }] } }), 'https://example.com/icon.png');
});

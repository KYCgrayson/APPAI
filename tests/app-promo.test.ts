import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerHostedRenderLoader } from './helpers/hosted-render-loader.mjs';
import { preferredStore } from '../src/lib/store-order.ts';
import { PRESET_DEFS, SECTION_DEFS } from '../src/lib/template-registry.ts';
import { checkPagePreview } from '../src/lib/page-preview.ts';
const hooks = registerHostedRenderLoader();
const { HeroSection } = await import('../src/templates/app-landing/sections/HeroSection.tsx');
const { DownloadSection } = await import('../src/templates/app-landing/sections/DownloadSection.tsx');
const { PricingSection } = await import('../src/templates/sections/PricingSection.tsx');
const { FaqSection } = await import('../src/templates/app-landing/sections/FaqSection.tsx');
const { IframeToolSection } = await import('../src/templates/sections/IframeToolSection.tsx');
const stores = { appStoreUrl: 'https://apps.apple.com/app/id123', playStoreUrl: 'https://play.google.com/store/apps/details?id=test' };
test('device ordering keeps both stores with deterministic SSR defaults', () => {
  assert.equal(preferredStore('iPhone'), 'app');
  assert.equal(preferredStore('iPad'), 'app');
  assert.equal(preferredStore('Android'), 'play');
  assert.equal(preferredStore('Linux desktop'), null);
  for (const variant of ['centered', 'minimal', 'split'] as const) {
    const html = renderToStaticMarkup(createElement(HeroSection, { renderVersion: 2, themeColor: '#123456', data: { variant, ctaUrl: stores.appStoreUrl, ctaSecondaryUrl: stores.playStoreUrl } }));
    assert.match(html, /aria-label="Download on the App Store"/);
    assert.match(html, /aria-label="Get it on Google Play"/);
    assert.ok(html.indexOf(stores.appStoreUrl) < html.indexOf('play.google.com'));
  }
  const playFirst = renderToStaticMarkup(createElement(HeroSection, { renderVersion: 2, themeColor: '#123456', data: { ctaUrl: stores.playStoreUrl, ctaSecondaryUrl: stores.appStoreUrl } }));
  assert.match(playFirst, /aria-label="Get it on Google Play" style="order:0"/);
  const generic = renderToStaticMarkup(createElement(HeroSection, { renderVersion: 2, themeColor: '#123456', data: { ctaText: 'Download' } }));
  assert.match(generic, /href="#download"/);
  const html = renderToStaticMarkup(createElement(DownloadSection, { renderVersion: 2, themeColor: '#123456', data: stores }));
  assert.match(html, /Download on the App Store/);
  assert.match(html, /Get it on Google Play/);
});
test('pricing and FAQ accept custom headings while preserving old titles', () => {
  assert.ok(SECTION_DEFS.find(s => s.type === 'pricing')!.fields.some(field => field.name === 'subheading'));
  const cases = [
    { fallback: 'Pricing', render: (extra = {}) => renderToStaticMarkup(createElement(PricingSection, { themeColor: '#123456', data: { items: [{ name: 'Free', price: '0', features: [] }], ...extra } })) },
    { fallback: 'FAQ', render: (extra = {}) => renderToStaticMarkup(createElement(FaqSection, { themeColor: '#123456', data: { items: [{ question: 'Why?', answer: 'Because.' }], ...extra } })) },
  ];
  for (const { render, fallback } of cases) {
    assert.match(render(), new RegExp('>' + fallback + '</h2>'));
    const custom = render({ heading: 'Custom title', subheading: 'Custom subtitle' });
    assert.match(custom, /Custom title/); assert.match(custom, /Custom subtitle/);
  }
});
test('iframe permissions preserve downloads and clipboard with fullscreen disabled', () => {
  for (const allowFullscreen of [true, false]) {
    const html = renderToStaticMarkup(createElement(IframeToolSection, { themeColor: '#123456', data: { src: 'https://test.pages.dev', allowFullscreen } }));
    assert.match(html, /sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"/);
    assert.match(html, /allow="[^"]*clipboard-write/);
    assert.equal(/allow="fullscreen;/.test(html), allowFullscreen);
    assert.doesNotMatch(html, /allow-top-navigation/);
  }
});
test('app preset example matches declared sections and warns on screenshots', () => {
  const preset = PRESET_DEFS.find(p => p.id === 'app-landing')!;
  const body = preset.example as { content: { sections: { type: string }[] } };
  assert.deepEqual(body.content.sections.map(s => s.type), preset.sections);
  const preview = checkPagePreview(body);
  assert.ok(preview.warnings.some(w => w.message.startsWith('Replace demo screenshot')));
});
test('additional sections expose headings and subheadings in schema and renderer', async () => {
  const fixtures = [
    ['Stats', { items: [{ value: '10', label: 'Users' }] }, 'stats'],
    ['Testimonials', { items: [{ name: 'Reviewer', quote: 'Great' }] }, 'testimonials'],
    ['Gallery', { items: [{ url: 'https://example.com/photo.png' }] }, 'gallery'],
    ['Team', { items: [{ name: 'Developer', role: 'Builder' }] }, 'team'],
    ['Schedule', { items: [{ time: '10:00', title: 'Start' }] }, 'schedule'],
    ['Sponsors', { items: [{ name: 'Sponsor', logo: 'https://example.com/logo.png' }] }, 'sponsors'],
    ['Video', { url: 'https://example.com/video.mp4' }, 'video'],
  ] as const;
  for (const [name, data, type] of fixtures) {
    const { [name + 'Section']: Component } = await import('../src/templates/sections/' + name + 'Section.tsx');
    const html = renderToStaticMarkup(createElement(Component, { renderVersion: 2, typographyActive: true, themeColor: '#123456', data: { ...data, heading: 'Custom section', subheading: 'Supporting copy' } }));
    assert.match(html, /Custom section/, type);
    if (type === "stats" || type === "video") assert.match(html, /<h2 data-typography-role="heading"[^>]*style="color:#123456"/);
    assert.match(html, /Supporting copy/, type);
    for (const field of ['heading', 'subheading']) assert.ok(SECTION_DEFS.find(s => s.type === type)!.fields.some(f => f.name === field), type);
  }
});
test.after(() => hooks.deregister());

test('download validates badge hosts and uses plain buttons for other HTTPS URLs', () => {
  for (const url of ['https://example.com/download', 'https://apps.apple.com.evil.test/app']) {
    const html = renderToStaticMarkup(createElement(DownloadSection, { renderVersion: 2, themeColor: '#123456', data: { appStoreUrl: url, heading: '', ctaText: '' } }));
    assert.match(html, /Download Now/);
    assert.doesNotMatch(html, /aria-label="Download on the App Store"/);
    assert.ok(html.includes(url));
  }
  for (const url of ['http://apps.apple.com/app/id123', 'javascript:alert(1)']) {
    assert.equal(renderToStaticMarkup(createElement(DownloadSection, { renderVersion: 2, themeColor: '#123456', data: { appStoreUrl: url } })), '');
  }
});

test('store badges reserve equal dimensions and render nothing without store URLs', async () => {
  const { StoreBadges } = await import('../src/templates/shared/StoreBadges.tsx');
  assert.equal(renderToStaticMarkup(createElement(StoreBadges, {})), '');
  const html = renderToStaticMarkup(createElement(StoreBadges, stores));
  assert.equal((html.match(/w-60 h-20 shrink-0/g) || []).length, 2);
  assert.doesNotMatch(html, /min-h-/);
});

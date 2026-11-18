import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fixtureDb, registerHostedRenderLoader, registerHostedHeaders, registerHostedNavigationState, registerDirectoryFixtures, registerAdminAppNavigation } from './helpers/hosted-render-loader.mjs';
import { registerMainHostedBaseline } from './helpers/hosted-chrome-regression.mjs';
import { renderHtml } from './helpers/render-html.mjs';
import { hostedChromeBrowser } from './helpers/hosted-chrome-browser.mjs';
import { app, page } from './fixtures/pr5-pages.ts';
import { inheritHeadingColor } from '../src/lib/heading-color.ts';
import { PAGE_STYLES } from '../src/lib/page-styles.ts';
import { sanitizePageContent } from '../src/lib/sanitize.ts';

const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerHostedNavigationState({ open: false, user: null }), registerDirectoryFixtures({ translated: true })];
const baseline = registerMainHostedBaseline('548b0ea', ['@/i18n/navigation']);
test.after(() => { baseline.deregister(); hooks.reverse().forEach(h => h.deregister()); });
const { PageRenderer } = await import('../src/templates/shared/PageRenderer.tsx');
const { PageRenderer: BeforeRenderer } = await import(baseline.moduleUrl('src/templates/shared/PageRenderer.tsx'));
const { default: Layout } = await import('../src/app/p/[...segments]/layout.tsx');
const { default: HostedPage, generateMetadata } = await import('../src/app/p/[...segments]/page.tsx');
const { default: BeforeHostedPage, generateMetadata: beforeMetadata } = await import(baseline.moduleUrl('src/app/p/[...segments]/page.tsx'));
const { default: AppDetail, generateMetadata: appMetadata } = await import('../src/app/[locale]/apps/[id]/page.tsx');
const { default: BeforeAppDetail, generateMetadata: beforeAppMetadata } = await import(baseline.moduleUrl('src/app/[locale]/apps/[id]/page.tsx'));
const { loadPublicAppDetail, loadPublicDirectory, loadPublicHome } = await import('../src/lib/public-directory.ts');
const image = 'https://i.ytimg.com/vi/fixture/maxresdefault.jpg';
const sections = [
  { type: 'hero', data: { headline: 'Ocean project', subheadline: 'A fixture page', variant: 'centered', heroHeight: 'small' } },
  { type: 'features', data: { heading: 'Features', items: [{ title: 'Readable headings', description: 'Clear body copy' }] } },
  { type: 'about', data: { heading: 'About', text: '## Markdown heading\nA [body link](https://example.com).' } },
  { type: 'cta', data: { headline: 'Get started', buttonText: 'Continue', buttonUrl: 'https://example.com' } },
];
const content = (headingColor?: string) => ({ renderVersion: 2, logo: '/logo.svg', sections, ...(headingColor ? { headingColor } : {}) });
function fixture(rootHeading?: string, childHeading?: string, darkMode = false) {
  const root = page('ocean', { themeColor: '#0077bb', darkMode, content: content(rootHeading) });
  const child = page('episode', { parentSlug: 'ocean', themeColor: '#0077bb', darkMode, content: content(childHeading) });
  fixtureDb.rows = [root, child]; fixtureDb.apps = [app('ocean-app', 'ocean')]; fixtureDb.locale = 'en';
  return { root, child };
}
const paramsFor = (child = false) => ({ params: Promise.resolve({ segments: child ? ['ocean', 'episode'] : ['ocean'] }) });
const jsonLd = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => match[1]);

test('56 default/theme renders remain byte-identical to main 548b0ea across kits, modes, root/child and render versions', async () => {
  let count = 0;
  for (const kit of PAGE_STYLES) for (const headingColor of [undefined, 'theme']) for (const child of [false, true]) for (const renderVersion of [1, 2]) {
    const row = page('ocean', { ...kit, content: { ...content(headingColor), renderVersion }, ...(child ? { parentSlug: 'site' } : {}) });
    assert.equal(await renderHtml(createElement(PageRenderer, { page: row })), await renderHtml(createElement(BeforeRenderer, { page: row })));
    count++;
  }
  assert.equal(count, 56);
});

test('child inherits headingColor only; own theme/dark overrides root and SEO stays identical', async () => {
  assert.equal(inheritHeadingColor(null, {}), null);
  for (const rootMode of [undefined, 'theme', 'dark']) for (const childMode of [undefined, 'theme', 'dark']) for (const dark of [false, true]) {
    fixture(rootMode, childMode, dark);
    const params = paramsFor(true);
    const html = await renderHtml(await HostedPage(params));
    assert.equal(html.includes('data-heading-color="dark"'), (childMode ?? rootMode) === 'dark');
    assert.deepEqual(await generateMetadata(params), await beforeMetadata(params));
    assert.deepEqual(jsonLd(html), jsonLd(await renderHtml(await BeforeHostedPage(params))));
    if (!rootMode && !childMode) assert.equal(html, await renderHtml(await BeforeHostedPage(params)));
    assert.equal((fixtureDb.rows[1].content as Record<string, unknown>).headingColor, childMode, 'render does not mutate saved JSON');
  }
});

test('HTTPS thumbnail survives sanitizer and actual child route in centered/split; minimal intentionally ignores it', async () => {
  for (const variant of ['centered', 'split', 'minimal']) {
    const { child } = fixture();
    child.content = sanitizePageContent({ sections: [{ type: 'hero', data: { headline: 'Thumbnail', variant, backgroundImage: image } }] }) as never;
    const html = await renderHtml(await HostedPage(paramsFor(true)));
    assert.equal(html.includes(image), variant !== 'minimal');
    if (variant === 'centered') assert.ok(html.includes(`background-image:url(${image})`));
    if (variant === 'split') assert.ok(html.includes(`src="${image}"`));
  }
  const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.ok(config.includes("img-src 'self' data: blob: https:"));
});

test('root content logo reaches light/dark headers, favicon, home, directory, App detail; detail SEO stays unchanged', async () => {
  for (const logo of ['/logo.svg', 'https://example.com/logo.svg']) for (const dark of [false, true]) {
    const { root } = fixture(undefined, undefined, dark);
    root.content = { ...content(), logo } as never;
    for (const child of [false, true]) {
      const html = await renderHtml(await Layout({ ...paramsFor(child), children: 'Body' }));
      assert.ok(html.match(/<header[\s\S]*?<\/header>/)![0].includes(`src="${logo}"`));
    }
    assert.deepEqual((await generateMetadata(paramsFor())).icons, { icon: logo, apple: logo });
    assert.equal((await loadPublicDirectory('en')).entries[0].app.logoUrl, logo);
    assert.equal((await loadPublicHome('en')).recentApps[0].logoUrl, logo);
    const detail = await loadPublicAppDetail('ocean-app', 'en');
    assert.equal(detail!.displayLogoUrl, logo);
    assert.equal(detail!.app.logoUrl, null, 'stored App logo remains untouched');
    const params = { params: Promise.resolve({ id: 'ocean-app', locale: 'en' }) };
    const html = await renderHtml(await AppDetail(params));
    const before = await renderHtml(await BeforeAppDetail(params));
    assert.ok(html.includes(`src="${logo}"`));
    assert.ok(!before.includes(`src="${logo}"`), 'main reproduces missing detail image');
    assert.deepEqual(await appMetadata(params), await beforeAppMetadata(params));
    assert.deepEqual(jsonLd(html), jsonLd(before));
  }
});

test('App detail fallback selects only same-organization published roots and keeps explicit App logos', async () => {
  fixture();
  fixtureDb.rows.push(page('ocean', { organizationId: 'other', content: { logo: '/foreign.svg' } }));
  fixtureDb.rows.push(page('ocean', { locale: 'ja', isDefault: false, isPublished: false, content: { logo: '/draft.svg' } }));
  assert.equal((await loadPublicAppDetail('ocean-app', 'ja'))!.displayLogoUrl, '/logo.svg');
  fixtureDb.apps[0].logoUrl = '/app.svg';
  assert.equal((await loadPublicAppDetail('ocean-app', 'ja'))!.displayLogoUrl, '/app.svg');
});

function contrast(fg: string, bg: string) {
  const lum = (value: string) => value.match(/\d+/g)!.slice(0, 3).map(Number).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [.2126, .7152, .0722][i], 0);
  const a = lum(fg), b = lum(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test('neutral headings have AA contrast and no horizontal scroll at 375px (light/dark); before/after screenshots', {
  skip: process.env.DARK_STYLE_BROWSER_TESTS !== '1' ? 'Opt in with DARK_STYLE_BROWSER_TESTS=1' : false,
}, async () => {
  const require = createRequire(import.meta.url);
  const cssPath = new URL('../src/app/globals.css', import.meta.url).pathname;
  const source = readFileSync(cssPath, 'utf8').replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../";');
  const css = (await require('postcss')([require('@tailwindcss/postcss')({ optimize: true })]).process(source, { from: cssPath })).css;
  const browser = await hostedChromeBrowser(process.env.HOSTED_CHROME_BINARY || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  try {
    await browser.send('Network.enable');
    await browser.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const dark of [false, true]) for (const heading of [undefined, 'dark']) for (const surface of [undefined, '#000000', '#ffffff']) {
      const { child } = fixture(heading, undefined, dark);
      if (surface) child.content = { ...content(), sections: [...sections.map(section => section.type === 'features' ? { ...section, data: { ...section.data, backgroundColor: surface } } : section), { type: 'about', data: { heading: 'Private details', access: 'login' } }] } as never;
      const html = await renderHtml(await HostedPage(paramsFor(true)));
      await browser.send('Page.setDocumentContent', { frameId: (await browser.send('Page.getFrameTree')).frameTree.frame.id,
        html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${html}</body></html>` });
      const result = await browser.evaluate(`(() => {
        const bg = el => { while(el) { const c = getComputedStyle(el).backgroundColor; if(c !== 'rgba(0, 0, 0, 0)') return c; el = el.parentElement; } return 'rgb(255, 255, 255)'; };
        return { width: document.documentElement.scrollWidth, pairs: [...document.querySelectorAll('h1,h2,h3')].map(el => [el.textContent, getComputedStyle(el).color, bg(el)]), link: getComputedStyle(document.querySelector('.prose a')).color };
      })()`);
      assert.ok(result.width <= 375, JSON.stringify(result));
      if (heading) for (const [label, fg, bg] of result.pairs) assert.ok(contrast(fg, bg) >= 4.5, `${dark}/${label}: ${fg} on ${bg}`);
      if (heading && !surface) assert.equal(result.pairs[1][1], dark ? 'rgb(249, 250, 251)' : 'rgb(17, 24, 39)');
      const dir = process.env.SMALL_BUGS_QA_DIR;
      if (dir && !surface) { mkdirSync(dir, { recursive: true }); const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(`${dir}/${dark ? 'dark' : 'light'}-${heading ? 'after' : 'before'}-375.png`, Buffer.from(shot.data, 'base64')); }
    }
  } finally { await browser.close(); }
});

test('invalid higher-priority logos cannot hide a valid content.logo in headers or favicon', async () => {
  for (const dark of [false, true]) for (const headerLogo of ['#', ' ', 'logo.png', 'http://example.com/logo.png']) {
    const { root } = fixture(undefined, undefined, dark); root.headerLogo = headerLogo as never;
    const html = await renderHtml(await Layout({ ...paramsFor(), children: 'Body' }));
    assert.ok(html.match(/<header[\s\S]*?<\/header>/)![0].includes('src="/logo.svg"'));
    assert.deepEqual((await generateMetadata(paramsFor())).icons, { icon: '/logo.svg', apple: '/logo.svg' });
  }
});

test('admin App list falls back to published root logo without mixing organizations', async () => {
  const navigation = registerAdminAppNavigation();
  const { default: AdminApps } = await import('../src/app/admin/apps/page.tsx');
  navigation.deregister();
  const { root } = fixture();
  fixtureDb.apps[0].organization = { name: 'Fixture studio' };
  const render = () => renderHtml(AdminApps({ searchParams: Promise.resolve({}) }));
  assert.ok((await render()).includes('src="/logo.svg"'));
  root.isPublished = false;
  fixtureDb.rows.push(page('ocean', { organizationId: 'foreign', content: { logo: '/foreign.svg' } }));
  const html = await render();
  assert.ok(!html.includes('src="/logo.svg"') && !html.includes('src="/foreign.svg"'));
});

test('neutral heading palette meets AA on default, kit and explicit surfaces', async () => {
  const { sectionHeadingColor } = await import('../src/lib/heading-color.ts');
  const rgb = (hex: string) => 'rgb(' + hex.slice(1).match(/../g)!.map(c => parseInt(c, 16)).join(',') + ')';
  for (const kit of PAGE_STYLES) {
    const color = sectionHeadingColor('about', {}, kit.darkMode, kit.themeColor);
    for (const bg of kit.darkMode ? ['#111827', '#1f2937', ...kit.backgroundColors] : ['#ffffff', '#f9fafb', ...kit.backgroundColors]) assert.ok(contrast(rgb(color), rgb(bg)) >= 4.5);
    for (const type of ['cta', 'download']) assert.ok(contrast(rgb(sectionHeadingColor(type, {}, kit.darkMode, kit.themeColor)), rgb(kit.themeColor)) >= 4.5);
  }
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
    const backgroundColor = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    assert.ok(contrast(rgb(sectionHeadingColor('about', { backgroundColor }, false, '#000000')), rgb(backgroundColor)) >= 4.5);
  }
});

test('neutral heading styles reach CTA/media and reset at built-in card surfaces', async () => {
  for (const darkMode of [false, true]) {
    const row = page('contrast', { darkMode, themeColor: '#0077bb', content: { headingColor: 'dark', renderVersion: 2, sections: [
      { type: 'cta', data: { headline: 'CTA', buttonText: 'Go', buttonUrl: '/' } },
      { type: 'hero', data: { headline: 'Media', backgroundImage: image } },
      { type: 'features', data: { backgroundColor: darkMode ? '#ffffff' : '#000000', heading: 'Features', items: [{ title: 'Card', description: 'Body' }] } },
    ] } });
    const html = await renderHtml(createElement(PageRenderer, { page: row }));
    assert.match(html, /<div style="--page-heading-neutral:#ffffff"><section[^>]*style="background-color:#0077bb/);
    assert.match(html, /<div style="--page-heading-neutral:#ffffff"><section[^>]*background-image/);
    assert.match(html, /\.bg-white,\.bg-gray-50[^}]*--page-heading-neutral:#111827/);
    assert.match(html, /\.bg-gray-800[^}]*--page-heading-neutral:#f9fafb/);
    assert.ok(html.includes(darkMode ? 'bg-gray-800' : 'bg-white'));
  }
});

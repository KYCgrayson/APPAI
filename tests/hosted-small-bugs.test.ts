import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fixtureDb, registerHostedRenderLoader, registerHostedHeaders, registerHostedNavigationState, registerDirectoryFixtures, registerAdminAppNavigation } from './helpers/hosted-render-loader.mjs';
import { stripVisitorChromeAttributes, registerMainHostedBaseline } from './helpers/hosted-chrome-regression.mjs';
import { renderHtml } from './helpers/render-html.mjs';
import { hostedChromeBrowser } from './helpers/hosted-chrome-browser.mjs';
import { app, page } from './fixtures/pr5-pages.ts';
import { inheritHeadingColor } from '../src/lib/heading-color.ts';
import { PAGE_STYLES } from '../src/lib/page-styles.ts';
import { sanitizePageContent } from '../src/lib/sanitize.ts';

const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerHostedNavigationState({ open: false, user: null }), registerDirectoryFixtures({ translated: true })];
const baseline = registerMainHostedBaseline('548b0ea', ['@/i18n/navigation']);
const round1 = registerMainHostedBaseline('5c75d0a', ['@/i18n/navigation']);
test.after(() => { round1.deregister(); baseline.deregister(); hooks.reverse().forEach(h => h.deregister()); });
const { HeroSection } = await import('../src/templates/app-landing/sections/HeroSection.tsx');
const { HeroSection: Round1Hero } = await import(round1.moduleUrl('src/templates/app-landing/sections/HeroSection.tsx'));
const { generateMetadata: round1Metadata } = await import(round1.moduleUrl('src/app/p/[...segments]/page.tsx'));
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
    if (!rootMode && !childMode) assert.equal(stripVisitorChromeAttributes(html), await renderHtml(await BeforeHostedPage(params)));
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
    for (const bg of kit.darkMode ? ['#111827', '#1f2937', ...kit.backgroundColors] : ['#ffffff', '#f9fafb', ...kit.backgroundColors]) assert.ok(contrast(rgb(color!), rgb(bg)) >= 4.5);
    for (const type of ['cta', 'download']) assert.ok(contrast(rgb(sectionHeadingColor(type, {}, kit.darkMode, kit.themeColor)!), rgb(kit.themeColor)) >= 4.5);
  }
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
    const backgroundColor = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    assert.ok(contrast(rgb(sectionHeadingColor('about', { backgroundColor }, false, '#000000')!), rgb(backgroundColor)) >= 4.5);
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

test('hero media changes only broken light minimal/split text; centered output is byte-identical to round 1', async () => {
  for (const variant of ['minimal', 'split', 'centered'] as const) for (const darkMode of [false, true]) {
    for (const backgroundColor of [undefined, '#000000', '#ffffff']) for (const media of [{}, { backgroundImage: image }, { backgroundVideo: 'https://example.com/video.mp4' }]) {
      const props = { themeColor: '#0077bb', darkMode, data: { headline: 'Readable headline', subheadline: 'Readable description', variant, backgroundColor, ...media } };
      const before = await renderHtml(createElement(Round1Hero, props));
      const after = await renderHtml(createElement(HeroSection, props));
      const broken = variant !== 'centered' && !darkMode && !backgroundColor && Object.keys(media).length > 0;
      assert.equal(after, broken ? before.replace('color:#fff', 'color:#0077bb').replace('text-gray-300', 'text-gray-600') : before);
      if (broken) {
        assert.match(after, /<h1[^>]*style="color:#0077bb"/);
        assert.match(after, /<p[^>]*text-gray-600/);
      }
    }
  }
});

const cssUrlCases = [
  ['https://example.com/File:Foo_(bar).jpg', 'https://example.com/File:Foo_%28bar%29.jpg'],
  ['https://example.com/a b.jpg', 'https://example.com/a%20b.jpg'],
  ['https://example.com/a"b\'c.jpg', 'https://example.com/a%22b%27c.jpg'],
  ['https://example.com/a\\b.jpg', 'https://example.com/a%5Cb.jpg'],
  ['https://example.com/a\u00a0b.jpg', 'https://example.com/a%C2%A0b.jpg'],
  ['https://example.com/already%20encoded.jpg?size=large', 'https://example.com/already%20encoded.jpg?size=large'],
];

test('hero CSS URLs encode delimiters/whitespace without changing ordinary or already encoded URLs', async () => {
  for (const [url, encoded] of cssUrlCases) {
    const html = await renderHtml(createElement(HeroSection, { themeColor: '#0077bb', data: { backgroundImage: url } }));
    assert.ok(html.includes(`background-image:url(${encoded})`), html);
  }
  const props = { themeColor: '#0077bb', data: { backgroundImage: image } };
  assert.equal(await renderHtml(createElement(HeroSection, props)), await renderHtml(createElement(Round1Hero, props)));
});

test('neutral headings normalize short hex and opt out to theme styling for unknown explicit colours', async () => {
  const { sectionHeadingColor } = await import('../src/lib/heading-color.ts');
  for (const [backgroundColor, expected] of [['#000', '#ffffff'], ['#fff', '#000000'], [' #AbC ', '#000000']]) {
    assert.equal(sectionHeadingColor('about', { backgroundColor }, false, '#0077bb'), expected);
  }
  for (const backgroundColor of ['black', 'rgb(0, 0, 0)', '#0008', 'var(--custom-bg)']) {
    for (const darkMode of [false, true]) {
      assert.equal(sectionHeadingColor('about', { backgroundColor }, darkMode, '#0077bb'), undefined);
      const html = await renderHtml(createElement(PageRenderer, { page: page('unknown', { darkMode, themeColor: '#0077bb', content: {
        headingColor: 'dark', sections: [{ type: 'about', data: { heading: 'Theme heading', text: '## Markdown heading', backgroundColor } }],
      } }) }));
      assert.ok(html.includes(`data-heading-color="theme" style="background-color:${backgroundColor}"`));
      assert.ok(html.includes(':not([data-heading-color="theme"] *)'));
      for (const type of ['hero', 'cta', 'download']) {
        const sectionHtml = await renderHtml(createElement(PageRenderer, { page: page('unknown', {
          darkMode, themeColor: backgroundColor, content: { headingColor: 'dark', renderVersion: 2,
            sections: [{ type, data: { headline: 'Heading', heading: 'Heading', backgroundColor } }] },
        }) }));
        assert.ok(sectionHtml.includes('<div data-heading-color="theme"'), `${type}: ${sectionHtml}`);
      }
    }
  }
});

test('child favicon falls back to root header branding, never child hero photos; all other metadata stays byte-identical', async () => {
  for (const darkMode of [false, true]) for (const explicitLocale of [false, true]) for (const heroImage of [null, image]) {
    for (const rootLogo of ['header', 'content', 'hero-logo', 'hero-image', 'none']) {
      const { root, child } = fixture(undefined, undefined, darkMode);
      root.darkMode = !darkMode;
      root.content = { logo: rootLogo === 'content' || rootLogo === 'header' ? '/root-primary.svg' : undefined,
        sections: rootLogo === 'hero-logo' ? [{ type: 'hero', data: { logo: '/root-hero.svg' } }] : [] } as never;
      root.headerLogo = (rootLogo === 'header' ? '/root-header.svg' : 'http://invalid.example/logo.svg') as never;
      root.heroImage = (rootLogo === 'hero-image' ? '/root-legacy.jpg' : null) as never;
      child.content = { sections: [{ type: 'hero', data: { headline: 'Child' } }] } as never;
      child.heroImage = heroImage as never;
      const params = { params: Promise.resolve({ segments: ['ocean', ...(explicitLocale ? ['en'] : []), 'episode'] }) };
      const expected = rootLogo === 'header' ? darkMode ? '/root-primary.svg' : '/root-header.svg'
        : rootLogo === 'content' ? '/root-primary.svg' : rootLogo === 'hero-logo' ? '/root-hero.svg' : rootLogo === 'hero-image' ? '/root-legacy.jpg' : null;
      const actual = await generateMetadata(params);
      const before = await round1Metadata(params);
      assert.deepEqual(actual.icons, expected ? { icon: expected, apple: expected } : undefined);
      assert.equal(JSON.stringify({ ...actual, icons: undefined }), JSON.stringify({ ...before, icons: undefined }));
      if (expected) {
        const header = (await renderHtml(await Layout({ ...params, children: 'Body' }))).match(/<header[\s\S]*?<\/header>/)![0];
        assert.ok(header.includes(`src="${expected}"`));
      }
      for (const own of ['header', 'content', 'hero']) {
        child.headerLogo = (own === 'header' ? '/child.svg' : null) as never;
        child.content = { logo: own === 'content' ? '/child.svg' : undefined, sections: own === 'hero' ? [{ type: 'hero', data: { logo: '/child.svg' } }] : [] } as never;
        assert.deepEqual((await generateMetadata(params)).icons, { icon: '/child.svg', apple: '/child.svg' });
      }
    }
  }
});

test('round 2 browser: hero contrast, CSS URL parsing, unknown-surface theme fallback and screenshots', {
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
    const show = async (html: string) => browser.send('Page.setDocumentContent', {
      frameId: (await browser.send('Page.getFrameTree')).frameTree.frame.id,
      html: `<!doctype html><html><head><style>${css}</style></head><body style="background:white">${html}</body></html>`,
    });
    for (const variant of ['minimal', 'split'] as const) for (const before of [true, false]) {
      const html = await renderHtml(createElement(before ? Round1Hero : HeroSection, { themeColor: '#0077bb', data: {
        variant, headline: 'Readable headline', subheadline: 'Readable description', backgroundImage: image,
      } }));
      await show(html);
      const colors = await browser.evaluate("[getComputedStyle(document.querySelector('h1')).color, getComputedStyle(document.querySelector('p')).color]");
      for (const color of colors) assert.equal(contrast(color, 'rgb(255,255,255)') >= 4.5, !before);
      const dir = process.env.SMALL_BUGS_QA_DIR;
      if (dir) {
        mkdirSync(dir, { recursive: true });
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(`${dir}/round2-${variant}-${before ? 'before' : 'after'}-375.png`, Buffer.from(shot.data, 'base64'));
      }
    }
    for (const [url, encoded] of cssUrlCases) {
      await show(await renderHtml(createElement(HeroSection, { themeColor: '#0077bb', data: { backgroundImage: url } })));
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('section')).backgroundImage"), `url("${encoded}")`);
    }
    for (const backgroundColor of ['#000', '#fff', 'black', 'rgb(0, 0, 0)']) {
      const results: string[][] = [];
      for (const headingColor of ['theme', 'dark']) {
        await show(await renderHtml(createElement(PageRenderer, { page: page('contrast', { themeColor: '#0077bb', content: {
          headingColor, sections: [{ type: 'about', data: { heading: 'Theme heading', text: '## Markdown heading', backgroundColor } }],
        } }) })));
        results.push(await browser.evaluate("[...document.querySelectorAll('h1,h2,h3')].map(el => getComputedStyle(el).color)"));
      }
      if (backgroundColor.startsWith('#')) {
        for (const color of results[1]) assert.ok(contrast(color, backgroundColor === '#000' ? 'rgb(0,0,0)' : 'rgb(255,255,255)') >= 4.5);
      } else assert.deepEqual(results[1], results[0], 'unparsed backgrounds retain theme heading colours');
    }
  } finally { await browser.close(); }
});

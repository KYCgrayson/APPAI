import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractLogoFromContent, pageLogoWarnings, pageLogoUpdate } from '../src/lib/page-logo.ts';
import { checkPagePreview, parseDryRun, pagePreviewNext } from '../src/lib/page-preview.ts';
import { createPageSchema, updatePageSchema } from '../src/lib/validations/page.ts';
import { PRESET_DEFS, SECTION_DEFS } from '../src/lib/template-registry.ts';
import { sanitizeContent } from '../src/lib/sanitize.ts';

import { ICON_NAMES } from '../src/components/ui/icon-data.ts';
import { PAGE_STYLES } from '../src/lib/page-styles.ts';

const url = 'https://example.com/logo.png';
test('logo sources, precedence, and background exclusion', () => {
  assert.equal(extractLogoFromContent({ logo: url }), url);
  assert.equal(extractLogoFromContent({ sections: [{ type: 'hero', data: { logo: url } }] }), url);
  assert.equal(extractLogoFromContent({ logo: url }, 'https://example.com/header.png'), 'https://example.com/header.png');
  assert.equal(extractLogoFromContent({ heroImage: url }), null);
  assert.equal(extractLogoFromContent(null), null);
  assert.equal(extractLogoFromContent({ logo: 123, sections: null }), null);
  assert.equal(pageLogoWarnings({ content: { heroImage: url } }).length, 1);
  assert.match(pageLogoWarnings({})[0].message, /content.logo.*512|512.*content.logo/);
  assert.match(pageLogoWarnings({})[0].message, /POST \/api\/v1\/upload/);
});
test('HTTPS or same-origin logos; no fetching or child requirement', () => {
  for (const logo of [url, '/spec/examples/placeholder-logo.png']) assert.deepEqual(pageLogoWarnings({ content: { logo } }), []);
  for (const logo of ['http://example.com/logo.png', '//example.com/logo.png', 'javascript:alert(1)', '/\\example.com/logo']) assert.equal(pageLogoWarnings({ content: { logo } }).length, 1);
  assert.deepEqual(pageLogoWarnings({ parentSlug: 'root' }), []);
  assert.deepEqual(pageLogoWarnings({ parentSlug: 'root', headerLogo: 'http://example.com/logo.png' }), []);
  assert.ok(updatePageSchema.safeParse({ headerLogo: '/logo.png' }).success);
});
test('logo checks evaluate merged page state for updates', () => {
  const existing = { content: { logo: url }, parentSlug: null, headerLogo: null };
  assert.deepEqual(pageLogoWarnings({ ...existing, content: { ...existing.content, title: 'Changed' } }), []);
  assert.equal(pageLogoWarnings({ ...existing, content: {} }).length, 1);
  assert.equal(pageLogoWarnings({ ...existing, headerLogo: 'http://example.com/bad.png' }).length, 1);
});
test('shared dry-run validates, sanitizes, and warns without mutating input', () => {
  assert.equal(checkPagePreview({}).valid, false);
  const body = { slug: 'demo', title: 'Demo', content: { sections: [{ type: 'hero', data: { headline: '<b>Hello</b>', typo: true } }, { type: 'unrecognized', data: {} }] } };
  const before = JSON.stringify(body);
  const result = checkPagePreview(body);
  assert.equal(result.valid, true);
  for (const pattern of [/Missing root page logo/, /HTML tags/, /unknown field/, /Unknown section type/]) assert.ok(result.warnings.some(w => pattern.test(w.message)));
  assert.equal(JSON.stringify(body), before);
  assert.match(result.next, /POST/);
  for (const sections of [[null, 'bad'], 'bad', [{ type: 'hero', data: {} }], [{ type: 'features', data: { items: false } }]]) {
    assert.ok(checkPagePreview({ slug: 'demo', title: 'Demo', content: { sections } }).warnings.length);
  }
  assert.deepEqual(checkPagePreview({ slug: 'demo', title: 'Demo', parentSlug: 'root', themeColor: '#047857', fontFamily: 'Lato' }).warnings, []);
});
test('each preset is a copyable, clean full POST body matching its served file', () => {
  assert.equal(PRESET_DEFS.length, 10);
  for (const preset of PRESET_DEFS) {
    const file = JSON.parse(readFileSync(new URL(`../docs/examples/${preset.exampleFile}`, import.meta.url), 'utf8'));
    assert.deepEqual(file, preset.example);
    assert.equal(checkPagePreview(file).valid, true, preset.id);
    const data = createPageSchema.parse(file);
    assert.ok(data.isPublished);
    if (['profile', 'link-in-bio', 'portfolio', 'iframe-tool'].includes(preset.id)) assert.ok(!data.content.sections.some((section: { type: string }) => section.type === 'cta'));
    assert.ok(data.content.sections.length >= 2 && data.content.sections.length <= 6);
    for (const section of data.content.sections) assert.ok(SECTION_DEFS.some(def => def.type === section.type));
    assert.deepEqual(pageLogoWarnings(data), []);
    const warnings: Parameters<typeof sanitizeContent>[2] = [];
    sanitizeContent(data.content, undefined, warnings);
    assert.deepEqual(warnings, []);
    assert.deepEqual(checkPagePreview(file).warnings.map(w => w.message), Array.from({ length: JSON.stringify(file).split('placeholder-logo.png').length - 1 }, () => 'Replace demo logo: supply the user’s logo, or create a square 512×512 PNG with its own background; upload local files with POST /api/v1/upload and replace this value with the returned url before publishing.').concat(...(preset.id === 'iframe-tool' ? ['Replace demo value: replace with your deployed tool URL.'] : [])), preset.id);
  }
});
test('bundled logo is a small 512 square PNG; alias delegates before publishing', () => {
  const png = readFileSync(new URL('../docs/examples/placeholder-logo.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
  assert.ok(png.length < 20000);
  const route = readFileSync(new URL('../src/app/api/v1/pages/route.ts', import.meta.url), 'utf8');
  assert.ok(route.includes("if (dryRun) return previewPage(request)"));
  assert.ok(route.indexOf('return previewPage(request)') < route.indexOf('await validateApiKey'));
});

test('dry-run authentication skips all writes, including last-used metadata', () => {
  const route = readFileSync(new URL('../src/app/api/v1/pages/preview/route.ts', import.meta.url), 'utf8');
  assert.match(route, /validateApiKey\(request.headers.get\("authorization"\), \{ readOnly: true \}\)/);
  assert.doesNotMatch(route, /db\.\w+\.(create|update|delete|upsert)/);
});

test('missing logos preserve app logos and found logos update them', () => {
  assert.deepEqual(pageLogoUpdate({ heroImage: url }), {});
  assert.deepEqual({ logoUrl: url, ...pageLogoUpdate({}) }, { logoUrl: url });
  assert.deepEqual(pageLogoUpdate({ logo: url }), { logoUrl: url });
});
test('dry-run flags and hosted preview paths', () => {
  for (const flag of ['true', 'TRUE', '1', 'Yes']) assert.equal(parseDryRun(flag), true);
  for (const flag of [null, '', 'false', '0', 'NO']) assert.equal(parseDryRun(flag), false);
  assert.equal(parseDryRun('tru'), 'invalid');
  assert.ok(pagePreviewNext({ slug: 'contact', parentSlug: 'bakery', locale: 'ja' }, { origin: 'https://example.com', isDefault: false, exists: true }).includes('https://example.com/p/bakery/ja/contact'));
  assert.ok(pagePreviewNext({ slug: 'bakery' }, { exists: true }).includes('?upsert=true'));
  assert.ok(checkPagePreview({}).next);
});
test('documented JSON icons are bundled names or emoji', () => {
  const names = ICON_NAMES;
  const docs = readFileSync(new URL('../AGENT_INSTRUCTIONS.md', import.meta.url), 'utf8');
  assert.deepEqual(docs.split('Bundled names:')[1].trim().split('\n')[0].split(', '), ICON_NAMES);
  for (const match of (docs + JSON.stringify(PRESET_DEFS)).matchAll(/"icon"\s*:\s*"([^"\n]+)"/g)) assert.ok(names.includes(match[1]) || /\p{Extended_Pictographic}/u.test(match[1]), match[1]);
});

test('section discovery exposes icons and comma-list filtering in both formats', () => {
  const route = readFileSync(new URL('../src/app/api/v1/sections/route.ts', import.meta.url), 'utf8');
  assert.ok(route.includes('searchParams.get("type")?.split(",")'));
  assert.ok(route.includes('types.includes(section.type)'));
  assert.equal((route.match(/icons: ICON_NAMES/g) || []).length, 2);
  assert.match(route, /enriched.length === 0.*total: 0, validTypes:/);
});
test('features and contact accept custom heading and subheading', () => {
  const result = checkPagePreview({ slug: 'business', title: 'Business', themeColor: '#047857', fontFamily: 'Lato', content: { logo: url, sections: [
    { type: 'features', data: { heading: 'Services', subheading: 'How we help', items: [{ title: 'Design', description: 'Accessible websites.' }] } },
    { type: 'contact', data: { heading: 'Visit us', subheading: 'Say hello', email: 'hello@example.com' } },
  ] } });
  assert.deepEqual(result.warnings, []);
});

test('examples match named style kits and explicitly select English', () => {
  const used = new Set();
  for (const { example } of PRESET_DEFS) {
    assert.equal(example.locale, 'en');
    const kit = PAGE_STYLES.find(kit => ['themeColor', 'themeColorSecondary', 'fontFamily', 'darkMode'].every(key => example[key] === kit[key as keyof typeof kit]));
    assert.ok(kit);
    for (const section of createPageSchema.parse(example).content.sections) {
      if (section.type !== 'cta') assert.ok(kit.backgroundColors.includes(section.data.backgroundColor), section.type);
    }
    used.add(kit.id);
  }
  assert.ok(used.size >= 4);
  assert.ok(PRESET_DEFS.some(p => p.example.darkMode === true));
});
test('preview identifies repeated sections, all placeholder paths, and suggests icons', () => {
  const sections = [null, ...['hero', 'hero', 'project-cards'].map(type => ({ type, data: { logo: '/spec/examples/placeholder-logo.png', typo: true, items: [{ icon: 'sparkles-outlin', image: 'https://other.example/spec/examples/placeholder-logo.png' }] } }))];
  const result = checkPagePreview({ slug: 'demo', title: 'Demo', content: { sections } }, ICON_NAMES);
  for (const index of [1, 2]) {
    assert.ok(result.warnings.some(w => w.path === `sections[${index}](hero).typo`));
    assert.ok(result.warnings.some(w => w.path === `sections[${index}](hero).items[0].icon` && /sparkles-outline.*emoji/.test(w.message)));
    assert.ok(result.warnings.some(w => w.path === `content.sections[${index}](hero).data.logo` && /Replace demo/.test(w.message)));
  }
  assert.equal(result.warnings.filter(w => /Replace demo/.test(w.message)).length, 6);
  assert.ok(checkPagePreview({ slug: 'demo', title: 'Demo', headerLogo: '/spec/examples/placeholder-logo.png' }).warnings.some(w => w.path === 'headerLogo' && /Replace demo/.test(w.message)));
});


test('quick-start JSON matches the company-service preset and served example', () => {
  const docs = readFileSync(new URL('../AGENT_INSTRUCTIONS.md', import.meta.url), 'utf8');
  const quickStart = docs.split('## Publish in one minute')[1].split('## What You Can Build')[0];
  const block = quickStart.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(block);
  const body = JSON.parse(block[1]);
  const file = JSON.parse(readFileSync(new URL('../docs/examples/company-service.example.json', import.meta.url), 'utf8'));
  assert.deepEqual(body, file);
  assert.deepEqual(body, PRESET_DEFS.find(preset => preset.id === 'company-service')?.example);
});

test('icon suggestions prioritize prefixes and substrings before edit distance', () => {
  function suggestions(icon: string, names = ICON_NAMES) {
    const result = checkPagePreview({ slug: 'demo', title: 'Demo', content: { logo: url, sections: [
      { type: 'features', data: { items: [{ title: 'Feature', icon }] } },
    ] } }, names);
    const warning = result.warnings.find(w => w.path.endsWith('.icon'));
    assert.ok(warning);
    return warning.message.match(/Try (.*?) \(GET/)?.[1].split(', ');
  }
  assert.equal(suggestions('rocket')?.[0], 'rocket-outline');
  assert.match(suggestions('shield')?.[0] ?? '', /^shield-/);
  assert.deepEqual(suggestions('rocket', ['rockets', 'pocket', 'rocket-outline', 'a-rocket']), ['rocket-outline', 'rockets', 'a-rocket']);
  assert.equal(suggestions('sparkles-outlin')?.[0], 'sparkles-outline');
});

test('placeholder logo detection accepts mixed-case schemes and hosts but preserves path case', () => {
  for (const logo of ['HTTPS://APPAI.INFO/spec/examples/placeholder-logo.png', 'hTtP://Other.Example/spec/examples/placeholder-logo.png?demo=1#logo', '/spec/examples/placeholder-logo.png']) {
    const result = checkPagePreview({ slug: 'demo', title: 'Demo', content: { logo } });
    assert.ok(result.warnings.some(w => w.path === 'content.logo' && /Replace demo/.test(w.message)), logo);
  }
  const result = checkPagePreview({ slug: 'demo', title: 'Demo', content: { logo: 'https://appai.info/SPEC/examples/placeholder-logo.png' } });
  assert.ok(!result.warnings.some(w => /Replace demo/.test(w.message)));
});

test('preview warns on raw omitted styling even when schema supplies defaults', () => {
  const base = { slug: 'styled', title: 'Styled', content: { logo: url } };
  for (const missing of ['themeColor', 'fontFamily']) {
    const body: Record<string, unknown> = { ...base, themeColor: '#047857', fontFamily: 'Lato' };
    delete body[missing];
    const result = checkPagePreview(body, [], { origin: 'https://preview.example' });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].path, missing);
    assert.match(result.warnings[0].message, /defaults.*https:\/\/preview.example\/spec\/style/);
  }
  const result = checkPagePreview(base, [], { origin: undefined, exists: false });
  assert.deepEqual(result.warnings.map(w => w.path), ['themeColor', 'fontFamily']);
  assert.ok(result.warnings.every(w => w.message.includes('https://appai.info/spec/style')));
});

test('production preview context scopes style warnings to newly created pages', () => {
  const body = { slug: 'styled', title: 'Styled', content: { logo: url } };
  const origin = 'https://preview.example';
  const styles = (input: typeof body & { parentSlug?: string }, exists: boolean) =>
    checkPagePreview(input, [], { origin, exists }).warnings.filter(w => ['themeColor', 'fontFamily'].includes(w.path));
  assert.deepEqual(styles(body, false).map(w => w.path), ['themeColor', 'fontFamily']);
  assert.ok(styles(body, false).every(w => w.message.includes(`${origin}/spec/style`)));
  assert.deepEqual(styles(body, true), []);
  assert.deepEqual(styles({ ...body, parentSlug: 'root' }, false).map(w => w.path), ['fontFamily']);
  assert.deepEqual(styles({ ...body, parentSlug: 'root' }, true), []);
  const route = readFileSync(new URL('../src/app/api/v1/pages/preview/route.ts', import.meta.url), 'utf8');
  assert.match(route, /checkPagePreview\(body, ICON_NAMES, \{ origin: request.nextUrl.origin, exists: !!existing \}\)/);
  const publish = readFileSync(new URL('../src/app/api/v1/pages/route.ts', import.meta.url), 'utf8');
  assert.match(publish, /if \(dryRun\) return previewPage\(request\)/);
});


test('preset recipes reserve cta for landing pages', () => {
  const nonLanding = ['profile', 'link-in-bio', 'portfolio', 'iframe-tool'];
  const landing = ['app-landing', 'saas-landing', 'event', 'company-service', 'product', 'hiring'];
  for (const id of [...nonLanding, ...landing]) {
    const preset = PRESET_DEFS.find(preset => preset.id === id)!;
    assert.ok(preset, id);
    const expectsCta = landing.includes(id);
    assert.equal(preset.sections.includes('cta'), expectsCta, id);
    const example = createPageSchema.parse(preset.example);
    assert.equal(example.content.sections.some((section: { type: string }) => section.type === 'cta'), expectsCta, id);
    if (!expectsCta) assert.doesNotMatch(preset.description, /call-to-action|\bCTA\b/i, id);
  }
});


test('preview next uses locale paths before publishing and respects an existing default', () => {
  for (const locale of ['zh-TW', 'zh-CN', 'es']) {
    assert.ok(pagePreviewNext({ slug: 'bakery', locale }).endsWith(`/p/bakery/${locale}`));
    assert.ok(checkPagePreview({ slug: 'bakery', title: 'Bakery', locale }).next.endsWith(`/p/bakery/${locale}`));
    assert.ok(pagePreviewNext({ slug: 'bakery-contact', parentSlug: 'bakery', locale }).endsWith(`/p/bakery/${locale}/bakery-contact`));
  }
  assert.ok(pagePreviewNext({ slug: 'bakery', locale: 'en' }).endsWith('/p/bakery'));
  assert.ok(pagePreviewNext({ slug: 'bakery', locale: 'ja' }, { isDefault: true }).endsWith('/p/bakery'));
  assert.ok(pagePreviewNext({ slug: 'bakery', locale: 'en' }, { isDefault: false }).endsWith('/p/bakery/en'));
  const route = readFileSync(new URL('../src/app/api/v1/pages/preview/route.ts', import.meta.url), 'utf8');
  assert.match(route, /rootDefault \? rootDefault.locale === data.locale : data.locale === "en"/);
});

test('hearth is a light warm kit mirrored in the theme spec with readable white CTA text', () => {
  const kit = PAGE_STYLES.find(style => style.id === 'hearth')!;
  assert.equal(kit.darkMode, false);
  const theme = readFileSync(new URL('../docs/spec/theme.md', import.meta.url), 'utf8');
  for (const value of [kit.id, kit.themeColor, kit.themeColorSecondary, kit.fontFamily, ...kit.backgroundColors]) assert.ok(theme.includes(value));
  const luminance = (hex: string) => {
    const rgb = hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  assert.ok(1.05 / (luminance(kit.themeColor) + 0.05) >= 4.5);
});

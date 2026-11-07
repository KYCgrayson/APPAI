import test from 'node:test';
import { checkPagePreview } from '../src/lib/page-preview.ts';
import { createPageSchema } from '../src/lib/validations/page.ts';
import { PAGE_STYLES } from '../src/lib/page-styles.ts';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveImagePath, uploadTree, validateData, buildPayloads } from '../docs/examples/publish-person-site.mjs';

test('only image fields upload; links pass through at any nesting depth', async () => {
  const uploaded: string[] = [];
  const result = await uploadTree({ links: [{ url: '../../secret.png' }], nav: [{ url: 'relative' }], url: 'other.png', avatar: { url: 'a.png' }, icon: { url: 'https://example.com/i.png' }, screenshot: { url: '#image' }, nested: { images: ['b.jpg', { url: 'c.svg', alt: 'C' }, '/public.png'] } }, '.', async (url: string) => { uploaded.push(url); return `uploaded:${url}`; });
  assert.deepEqual(uploaded, ['a.png', 'b.jpg', 'c.svg']);
  assert.equal(result.links[0].url, '../../secret.png');
  assert.equal(result.nav[0].url, 'relative');
  assert.equal(result.url, 'other.png');
  assert.equal(result.nested.images[1].url, 'uploaded:c.svg');
});

test('image paths reject unsupported files, traversal, absolute paths, secrets and symlink escapes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'publisher-'));
  try {
    const data = join(root, 'data');
    await mkdir(data);
    await writeFile(join(data, 'ok.PNG'), 'image');
    await writeFile(join(root, 'outside.png'), 'outside');
    await symlink(join(root, 'outside.png'), join(data, 'escape.png'));
    await symlink(data, join(root, 'alias'));
    assert.equal(await resolveImagePath('ok.PNG', join(root, 'alias')), await realpath(join(data, 'ok.PNG')));
    for (const [path, error] of [['missing.txt', /extension/], ['../outside.png', /inside/], ['escape.png', /inside/], [join(data, 'ok.PNG'), /Absolute/], ['.env-folder/missing.png', /Secret/], ['nested/.env.png', /Secret/]] as [string, RegExp][]) {
      await assert.rejects(resolveImagePath(path, data), error);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('publisher shape errors are clear before processing images', () => {
  for (const locales of [undefined, null, [], 'en', {}]) assert.throws(() => validateData({ locales }), /locales/);
  for (const sections of [undefined, null, {}, 'bad']) assert.throws(() => validateData({ locales: { en: { sections } } }), /sections/);
  for (const items of [undefined, null, {}, 'bad', [null]]) assert.throws(() => validateData({ locales: { en: { sections: [{ type: 'project-cards', data: { items } }] } } }), /project-cards items/);
  assert.throws(() => validateData({ page: { isDefault: true }, locales: { en: { sections: [] } } }), /page may only/);
  validateData({ page: { darkMode: true }, locales: { en: { sections: [] } } });
});


test('person example builds valid root, child and root-project payloads for all four locales', async () => {
  const data = JSON.parse(await readFile(new URL('../docs/examples/person-site.example.json', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => validateData(data));
  assert.deepEqual(Object.keys(data.locales), ['en', 'zh-TW', 'zh-CN', 'es']);
  const kit = PAGE_STYLES.find(kit => kit.themeColor === data.page.themeColor)!;
  const payloads = await buildPayloads(data, '.', async () => 'https://example.com/uploaded.svg');
  assert.equal(payloads.length, 12);
  assert.ok(payloads.slice(0, 4).every(([payload]) => payload.content.logo === 'https://example.com/uploaded.svg'));
  assert.deepEqual(payloads.slice(0, 4).map(([payload]) => payload.locale), ['en', 'zh-TW', 'zh-CN', 'es']);
  for (const [payload, url] of payloads) {
    assert.equal(createPageSchema.safeParse(payload).success, true, JSON.stringify(payload));
    assert.equal(checkPagePreview(payload).valid, true, JSON.stringify(checkPagePreview(payload).errors));
    assert.equal(payload.fontFamily, payload.locale === 'zh-TW' ? 'Noto Sans TC' : payload.locale === 'zh-CN' ? 'Noto Sans SC' : kit.fontFamily);
    assert.equal(payload.themeColorSecondary, kit.themeColorSecondary);
    assert.equal(payload.themeColor, kit.themeColor);
    assert.equal(payload.darkMode, kit.darkMode);
    assert.ok(url.startsWith('https://appai.info/p/'));
    if (payload.parentSlug) assert.ok(payload.slug.startsWith(`${payload.parentSlug}-`));
  }
  data.locales['zh-TW'].fontFamily = 'Lato';
  const overridden = await buildPayloads(data, '.', async () => 'https://example.com/uploaded.svg');
  assert.ok(overridden.filter(([payload]) => payload.locale === 'zh-TW').every(([payload]) => payload.fontFamily === 'Lato'));
});


test('dry-run builds valid payloads without invoking upload, including root logos', async () => {
  const data = JSON.parse(await readFile(new URL('../docs/examples/person-site.example.json', import.meta.url), 'utf8'));
  const placeholder = 'https://appai.info/spec/examples/placeholder.svg';
  const upload = async () => { assert.fail('dry-run must never upload'); };
  const payloads = await buildPayloads(data, '/nonexistent-data-directory', upload, { dryRun: true });
  assert.equal(payloads.length, 12);
  for (const [payload] of payloads) {
    assert.equal(checkPagePreview(payload).valid, true);
    assert.ok(!JSON.stringify(payload).includes('./placeholder'));
  }
  for (const [payload] of payloads.slice(0, 4)) {
    assert.equal(payload.content.logo, placeholder);
    assert.equal(payload.content.sections[0].data.avatar.url, placeholder);
  }
  data.logo = 'https://example.com/real-logo.svg';
  for (const dryRun of [false, true]) {
    const roots = (await buildPayloads(data, '.', async () => placeholder, { dryRun })).slice(0, 4);
    assert.ok(roots.every(([payload]) => payload.content.logo === data.logo));
  }
});

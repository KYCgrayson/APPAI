import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveImagePath, uploadTree, validateData } from '../docs/examples/publish-person-site.mjs';

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

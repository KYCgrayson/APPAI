import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTypographyApiFixtures } from './helpers/typography-api-loader.mjs';
import { NextRequest } from 'next/server.js';
import { registerHostedRenderLoader, fixtureDb } from './helpers/hosted-render-loader.mjs';

const loader = registerHostedRenderLoader();
const stubs = registerTypographyApiFixtures();
const { POST } = await import('../src/app/api/v1/pages/route.ts');
const { PUT, PATCH } = await import('../src/app/api/v1/pages/[slug]/route.ts');
const state: { page: Record<string, unknown> | null } = { page: null };
const db = fixtureDb as unknown as Record<string, unknown>;
db.hostedPage = {
  async findUnique() { return state.page; },
  async findFirst(query: { where: Record<string, unknown> }) {
    if (query.where.template) return null;
    return state.page;
  },
  async findMany() { return []; },
  async count() { return 0; },
  async update({ data }: { data: Record<string, unknown> }) {
    assert.ok(!('textSize' in data || 'textContrast' in data || 'typography' in data));
    state.page = { ...state.page, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) };
    return state.page;
  },
  async create({ data }: { data: Record<string, unknown> }) {
    assert.ok(!('textSize' in data || 'textContrast' in data || 'typography' in data));
    state.page = { id: 'typography-page', ...data };
    return state.page;
  },
};
db.user = { async findFirst() { return { id: 'admin' }; } };
db.app = { async findFirst() { return { id: 'fixture-app' }; }, async update() {}, async updateMany() {} };
const req = (method: string, body: unknown, query = '') => new NextRequest('https://example.test/api/v1/pages' + query, { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const context = { params: Promise.resolve({ slug: 'typography-example' }) };

test('publish, upsert, PUT and PATCH persist JSON and return non-blocking typography warnings', async () => {
  const payload = { slug: 'typography-example', title: 'Example', textSize: 'xs', isPublished: true, content: { sections: [{ type: 'about', data: { text: 'Preserved text' } }] } };
  const created = await POST(req('POST', payload));
  assert.equal(created.status, 201);
  const published = await created.json();
  assert.equal(published.content.textSize, 'xs');
  assert.ok(published.warnings.some((w: { message: string }) => /below 14px/.test(w.message)));
  const upserted = await POST(req('POST', payload, '?upsert=true'));
  assert.equal(upserted.status, 200);
  assert.ok((await upserted.json()).warnings.some((w: { message: string }) => /below 14px/.test(w.message)));
  const put = await PUT(req('PUT', { typography: { body: 'xs' } }), context);
  assert.equal(put.status, 200);
  assert.ok((await put.json()).warnings.some((w: { message: string }) => /below 14px/.test(w.message)));
  const patched = await PATCH(req('PATCH', { textContrast: 'high' }), context);
  assert.equal(patched.status, 200);
  const result = await patched.json();
  assert.equal(result.content.textSize, 'xs');
  assert.equal(result.content.textContrast, 'high');
  assert.equal(result.content.sections[0].data.text, 'Preserved text');
  assert.ok(result.warnings.some((w: { message: string }) => /below 14px/.test(w.message)));
  for (const update of [PUT, PATCH]) {
    const invalid = await update(req('PATCH', { textSize: 'huge' }), context);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).details[0].path[0], 'textSize');
  }
  const dryRun = await POST(req('POST', { ...payload, textSize: '4xl', textContrast: 'high', typography: { display: '4xl' } }, '?dryRun=true&upsert=true'));
  const preview = await dryRun.json();
  assert.equal(preview.valid, true);
  assert.equal(preview.typography.display, 150);
  assert.equal(preview.typographyMobile.display, 54.9);
});
test.after(() => { stubs.deregister(); loader.deregister(); });

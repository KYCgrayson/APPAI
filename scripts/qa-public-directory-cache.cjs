/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in local production-build QA. */
// Build with the mock preload, then run this script. No listener or database is
// needed: Next's production request handler receives real streamed mock HTTP.
// See docs/apps/public-directory-cache-qa.md for commands and limitations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Socket } = require('node:net');
const { once } = require('node:events');
const { apps } = require('../tests/helpers/public-directory-production.cjs');
const next = require('next');
const { createRequestResponseMocks } = require('next/dist/server/lib/mock-request');
const output = process.env.DIRECTORY_QA_OUTPUT || '/private/tmp/appai-92a';
fs.mkdirSync(output, { recursive: true });
const log = process.env.DIRECTORY_QUERY_LOG || '/private/tmp/appai-92a/queries.jsonl';
const count = () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).length : 0;

(async () => {
  const app = next({ dev: false, dir: process.cwd(), hostname: 'localhost', port: 3192 });
  await app.prepare();
  const handle = app.getRequestHandler();
  async function request(url, body) {
    const chunks = [];
    const { req, res } = createRequestResponseMocks({ url, method: body ? 'PATCH' : 'GET', socket: new Socket(),
      headers: { host: 'localhost:3192', ...(body ? { 'content-type': 'application/json', cookie: 'authjs.session-token=fixture-admin-session' } : {}) },
      resWriter: chunk => { chunks.push(Buffer.from(chunk)); return true; } });
    Object.defineProperties(req, { aborted: { value: false }, complete: { value: true } });
    if (body) {
      let sent = false;
      req._read = function () { if (!sent) { sent = true; this.push(JSON.stringify(body)); this.push(null); } };
    }
    const finished = once(res, 'finish');
    await handle(req, res); await finished;
    return { status: res.statusCode, html: Buffer.concat(chunks).toString() };
  }
  try {
    const results = [];
    for (const [name, url] of [['home-en', '/'], ['home-zh-TW', '/zh-TW'], ['apps', '/apps'],
      ['tools', '/tools'], ['websites', '/websites'], ['app-detail', '/apps/fixture-native'],
      ['apps-kind', '/apps?kind=apps'], ['personal', '/websites?type=personal'],
      ['tools-category', '/tools?category=OTHER'], ['apps-zh-CN', '/zh-CN/apps'],
      ['tool-detail-zh-TW', '/zh-TW/apps/fixture-tool'], ['person-detail', '/apps/fixture-person']]) {
      const counts = [];
      for (let i = 0; i < 20; i++) {
        const before = count(); const response = await request(url); counts.push(count()-before);
        assert.equal(response.status, 200, `${url}: ${response.html.slice(0,300)}`);
        if (!i) {
          fs.writeFileSync(path.join(output, `${name}.html`), response.html);
          if (['home-en', 'home-zh-TW', 'apps'].includes(name)) assert.ok(response.html.includes('href="/p/fixture-native"'));
        }
      }
      assert.ok(counts[0] > 0, 'Use a cold .next/cache/fetch-cache for this verification');
      assert.ok(counts.slice(1).every(count => count === 0), `${url}: ${counts}`);
      results.push({ url, requests: 20, reads: counts, totalReads: counts.reduce((a,b)=>a+b,0) });
    }
    const response = await request('/api/admin/apps', { appId: 'fixture-native', action: 'unapprove' });
    assert.equal(response.status, 200, response.html);
    assert.equal(apps.find(app => app.id === 'fixture-native').isApproved, false);
    const invalidationChecks = [];
    for (const url of ['/', '/zh-TW', '/apps']) {
      const nextResponse = await request(url);
      assert.equal(nextResponse.status, 200);
      assert.ok(!nextResponse.html.includes('href="/p/fixture-native"'), `stale listing: ${url}`);
      invalidationChecks.push({ url, status: nextResponse.status, listingVisible: false });
    }
    const detail = await request('/apps/fixture-native');
    assert.ok(detail.status === 404 || !detail.html.includes('Fictional application for local verification.'), 'stale detail');
    fs.writeFileSync(path.join(output, 'production-evidence.json'), JSON.stringify({ results, invalidationChecks, detailStatusAfterUnapprove: detail.status, unapprove: 'actual admin PATCH 200; next home en/zh-TW, apps and detail requests hide listing', transport: 'Next production request handler with mocked HTTP streams; no listening socket' }, null, 2));
    console.log(JSON.stringify(results, null, 2));
    console.log('Admin unapprove immediately removed warmed listings.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

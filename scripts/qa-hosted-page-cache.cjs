/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in fictional production QA. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Socket } = require('node:net');
const { once } = require('node:events');
require('../tests/helpers/hosted-page-production.cjs');
const next = require('next');
const { createRequestResponseMocks } = require('next/dist/server/lib/mock-request');
const output = process.env.HOSTED_QA_OUTPUT;
assert.ok(output, 'HOSTED_QA_OUTPUT required');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.join(output, 'hot'), { recursive: true });
const log = process.env.HOSTED_QUERY_LOG;
const events = () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
const cases = [
  ['person', '/p/fixture-person', 200, 'en'], ['root', '/p/fixture-app', 200, 'en'],
  ['child', '/p/fixture-app/fixture-child', 200, 'en'], ['locale', '/p/fixture-app/zh-TW', 200, 'zh-TW'],
  ['zh-fallback', '/p/fixture-app/zh-CN', 200, 'zh-CN'], ['inline-tool', '/p/fixture-tool', 200, 'en'],
  ['fullscreen-tool', '/p/fixture-tool/tools/0', 200, 'en'], ['login-gate', '/p/fixture-login', 200, 'en'],
  ['fullscreen-gate', '/p/fixture-login/tools/0', 200, 'en'], ['unknown', '/p/missing-slug', 404, 'en'],
  ['missing-child', '/p/fixture-app/missing-child', 404, 'en'], ['missing-locale', '/p/fixture-app/ja', 404, 'en'],
  ['missing-policy', '/p/fixture-no-policy/privacy', 404, 'en'], ['privacy', '/p/fixture-app/privacy', 200, 'en'],
  ['terms', '/p/fixture-app/terms', 200, 'en'],
];
const visible = html => html.replace(/<script(?![^>]*type="application\/ld\+json")[^>]*>[\s\S]*?<\/script>/g, '');
function identities(html) {
  return [...visible(html).matchAll(/appai_session=([^&"<]+)/g)].map(m => JSON.parse(Buffer.from(decodeURIComponent(m[1]).split('.')[1], 'base64url').toString()));
}
function unavailable(r) {
  assert.ok(r.status === 404 || (r.status === 200 && /NEXT_HTTP_ERROR_FALLBACK;404/.test(r.html)), `Expected 404, got ${r.status}`);
  assert.match(r.html, /noindex/);
}
function breadcrumbs(html) {
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  return schemas.flatMap(s => s['@graph'] || [s]).filter(s => s['@type'] === 'BreadcrumbList');
}
(async () => {
  const app = next({ dev: false, dir: process.cwd(), hostname: 'localhost', port: 3193 });
  await app.prepare(); const handle = app.getRequestHandler();
  async function request(url, { method = 'GET', body, session, api = false, headers = {} } = {}) {
    const chunks = []; const before = events().length;
    const { req, res } = createRequestResponseMocks({ url, method, socket: new Socket(), headers: {
      host: 'localhost:3193', 'x-appai-hosted-path': url.startsWith('/p/') ? url.split('?')[0] : '',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(session ? { cookie: `authjs.session-token=fixture-${session}-session`, origin: 'http://localhost:3193' } : {}),
      ...(api ? { authorization: 'Bearer appai_sk_FICTIONAL_QA_ONLY' } : {}), ...headers,
    }, resWriter: chunk => { chunks.push(Buffer.from(chunk)); return true; } });
    Object.defineProperties(req, { aborted: { value: false }, complete: { value: true } });
    if (body) { let sent = false; req._read = function () { if (!sent) { sent = true; this.push(JSON.stringify(body)); this.push(null); } }; }
    const finished = once(res, 'finish'); await handle(req, res); await finished;
    // handler completion includes its waitUntil/cache work; yield queued logging.
    await new Promise(resolve => setImmediate(resolve));
    const all = events().slice(before);
    return { status: res.statusCode, html: Buffer.concat(chunks).toString(), headers: res.getHeaders(),
      reads: all.filter(e => e.type === 'read').length, writes: all.filter(e => e.type === 'write').length, events: all };
  }
  const mutations = [], results = [], authentication = [];
  async function mutation(name, url, options) {
    const r = await request(url, options); assert.ok(r.status >= 200 && r.status < 300, `${name}: ${r.status} ${r.html}`);
    mutations.push({ name, url, status: r.status, reads: r.reads, writes: r.writes }); return r;
  }
  async function nextGet(name, url, check) {
    const r = await request(url); check(r);
    const warm = await request(url); check(warm); assert.equal(warm.reads, 0, `${name}: next warm reads`);
    mutations.at(-1).checks ??= []; mutations.at(-1).checks.push({ name, url, status: r.status, firstReads: r.reads, warmReads: warm.reads }); return r;
  }
  try {
    for (const [name, url, status, lang] of cases) {
      // Real no-content-change admin mutation expires every family between cases.
      // No preceding route can silently prewarm this case's anonymous reads.
      if (!process.env.HOSTED_QA_BASELINE) await mutation('cold-case expiry', '/api/admin/apps', { method: 'PATCH', session: 'admin', body: {appId: 'listing-app', action: 'feature'} });
      const reads = [], vectors = [], statuses = [];
      for (let n = 0; n < (process.env.HOSTED_QA_BASELINE ? 1 : 20); n++) {
        const r = await request(url); reads.push(r.reads); vectors.push(r.events); statuses.push(r.status);
        // Streaming notFound can retain 200; assert noindex + the actual 404 body.
        if (status === 404) unavailable(r);
        else assert.equal(r.status, status, name);
        if (status === 200) assert.match(r.html, new RegExp(`<html[^>]*lang="${lang}"`), name);
        if (!n) fs.writeFileSync(path.join(output, `${name}.html`), r.html);
        if (n === 19) fs.writeFileSync(path.join(output, 'hot', `${name}.html`), r.html);
        if (!process.env.HOSTED_QA_BASELINE && n) assert.equal(r.reads, 0, `${url} #${n+1}`);
        assert.equal(r.writes, 0, `${name}: GET must not write DB`);
      }
      assert.ok(reads[0] > 0, `${name}: cold read missing`);
      results.push({ name, url, requests: reads.length, reads, statuses, vectors });
      console.log(`${name}: ${reads.join(',')}`);
    }
    if (process.env.HOSTED_QA_BASELINE) return;
    mutations.length = 0;
    const root = '/p/fixture-app';
    await mutation('page PUT', '/api/v1/pages/fixture-app', {method:'PUT', api:true, body:{title:'Fictional PUT title', metaTitle:'Fictional PUT metadata'}});
    await nextGet('body and metadata', root, r => { assert.match(visible(r.html), /Fictional PUT title/); assert.match(r.html, /<title>Fictional PUT metadata<\/title>/); });
    await mutation('page PATCH', '/api/v1/pages/fixture-child', {method:'PATCH', api:true, body:{title:'Fictional PATCH child'}});
    await nextGet('nav', root, r => assert.match(visible(r.html), /Fictional PATCH child/));
    await nextGet('child body', '/p/fixture-app/fixture-child', r => assert.match(visible(r.html), /Fictional PATCH child/));
    await mutation('unpublish', '/api/v1/pages/fixture-app/unpublish', {method:'POST', api:true});
    await nextGet('explicit root unavailable', '/p/fixture-app/en', unavailable);
    await mutation('publish', '/api/v1/pages/fixture-app/publish', {method:'POST', api:true});
    await nextGet('published again', root, r => assert.match(visible(r.html), /Fictional PUT title/));
    for (const action of ['unpublish','restore','delete','restore']) {
      const options = {method:'POST', session:'user', body:{action, targets:['fixture-app-en'], dryRun:true}};
      const dry = await request('/api/dashboard/pages/actions', options); assert.equal(dry.status,200,dry.html);
      const scope = JSON.parse(dry.html);
      await mutation(`dashboard ${action}`, '/api/dashboard/pages/actions', {...options, body:{action, targets:['fixture-app-en'], expected:{pages:scope.pages,rows:scope.rows}}});
      for (const url of [root, '/p/fixture-app/fixture-child', '/p/fixture-app/privacy']) await nextGet(`${action} visibility`, url, r => {
        if (action === 'restore') { assert.equal(r.status,200); assert.doesNotMatch(visible(r.html), /Page not found/); }
        else unavailable(r);
      });
    }
    // Negative root and child cache become visible through actual POST routes.
    for (const [slug, parentSlug] of [['missing-slug',null], ['missing-child','fixture-app']]) {
      const url = parentSlug ? `/p/${parentSlug}/${slug}` : `/p/${slug}`;
      await request(url);
      await mutation('POST creates cached 404', '/api/v1/pages', {method:'POST',api:true,body:{slug, ...(parentSlug ? {parentSlug} : {}), title:'Fictional newly published', isPublished:true, template:'APP_LANDING', content:{sections:[{type:'about',order:0,data:{text:'Fictional new content'}}]}}});
      await nextGet('404 becomes public', url, r => { assert.equal(r.status,200); assert.match(visible(r.html), /Fictional new content/); });
    }
    const listed = await request(root); assert.ok(breadcrumbs(listed.html).some(b => b.itemListElement.some(i => i.item === 'https://appai.info/apps')));
    await mutation('admin unapprove', '/api/admin/apps', {method:'PATCH',session:'admin',body:{appId:'listing-app',action:'unapprove'}});
    await nextGet('page survives; category and JSON-LD removed',root,r => {
      assert.equal(r.status,200); assert.match(visible(r.html), /Fictional PUT title/);
      assert.ok(breadcrumbs(r.html).every(b => b.itemListElement.every(i => i.item !== 'https://appai.info/apps')));
      assert.doesNotMatch(visible(r.html), /href="\/apps"/);
    });
    for (const url of ['/p/fixture-login','/p/fixture-login/tools/0','/p/fixture-tool']) {
      await request(url); // public cache may have been expired by the preceding mutation
      for (const session of [undefined,'user',undefined,'other','admin',undefined,'invalid']) {
        const r = await request(url, {session}); const body = visible(r.html); const signedIn = session && session !== 'invalid';
        assert.equal(r.status,200);
        if (!url.includes('/tools/0')) {
          if (signedIn) assert.match(body, new RegExp(`Fictional ${session}`));
          else assert.doesNotMatch(body, /Fictional (user|other|admin)/);
        }
        const tokens = identities(r.html);
        if (url.includes('fixture-login') && !signedIn) { assert.equal(tokens.length,0); assert.match(body,/Sign in/); }
        else { assert.ok(tokens.length > 0, 'iframe identity missing'); for (const token of tokens) {
          assert.equal(token.sub,signedIn ? `fixture-${session}` : null); assert.equal(token.aud,'https://fixture.pages.dev'); assert.ok(token.exp > token.iat);
        } }
        if (!session) assert.equal(r.reads,0,`${url}: anonymous after user`);
        if (session) assert.ok(r.events.some(e=>e.model==='session' && e.type==='read'));
        authentication.push({url, viewer:session || 'anonymous', reads:r.reads, identitySubjects:tokens.map(t=>t.sub)});
      }
    }
    const redirect = await request(root,{headers:{'accept-language':'zh-TW, en;q=0.5'}});
    assert.ok(redirect.headers.location === '/p/fixture-app/zh-TW' || redirect.html.includes('NEXT_REDIRECT;replace;/p/fixture-app/zh-TW;307;'));
    const preference = await request(root,{headers:{'accept-language':'zh-TW','cookie':'appai_locale=en'}});
    assert.equal(preference.status,200); assert.match(preference.html,/<html[^>]*lang="en"/);
    const sessionEndpoint = await request('/api/auth/session'); assert.equal(sessionEndpoint.reads,0);
    const oversized = [];
    for (let n = 0; n < 2; n++) {
      const r = await request('/p/fixture-large'); assert.equal(r.status,200);
      assert.match(r.html, /oversized-fixture/); assert.ok(r.reads > 0);
      oversized.push(r.reads);
    }
    const stored = fs.readdirSync('.next/cache/fetch-cache').map(file => {
      const json = fs.readFileSync(path.join('.next/cache/fetch-cache',file),'utf8');
      return {json, value:JSON.parse(json)};
    }).filter(entry => entry.value.tags?.includes('hosted-page'));
    assert.ok(stored.length);
    for (const {json, value} of stored) {
      assert.ok(Buffer.byteLength(json) <= 1_800_000);
      assert.doesNotMatch(value.data.body, /oversized-fixture|Fictional (user|other|admin)|fixture-(user|other|admin)-session|appai1\./);
      assert.doesNotMatch(value.data.body, /"(?:sessionToken|userId|removedById|removalState|customDomain)":/);
    }
    const cache = {entries:stored.length,maxBytes:Math.max(...stored.map(e=>Buffer.byteLength(e.json))),oversizedReads:oversized};
    fs.writeFileSync(path.join(output,'production-evidence.json'),JSON.stringify({results,mutations,authentication,
      cache, language:{redirect:redirect.status,preference:preference.status},anonymousSessionReads:sessionEndpoint.reads,
      transport:'Real Next production handler + real Data Cache; mocked HTTP streams and Prisma delegates. Middleware path header supplied by harness; no SQL or listener.'},null,2));
    console.log('Hosted production QA passed.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

import { localeEdge, managedPage } from "./fixtures/pr5-removal.ts";
import { interactionContent } from "./fixtures/pr5-pages.ts";
import { managePages } from "../src/lib/page-management.ts";
import { managementStore } from "./helpers/pr5-management-store.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server.js";
import { fixtureDb, matchesWhere, registerHostedRenderLoader, registerHostedHeaders, registerDirectoryFixtures, registerSitemapFixtures, fixtureSitemapCache } from "./helpers/hosted-render-loader.mjs";
import { registerPr5PublicFixtures, pr5State } from "./helpers/pr5-public-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { f1Pages, f1Apps, f1Expected, f2Pages, page, PR5_NOW } from "./fixtures/pr5-pages.ts";
import { publicPageWhere, publicAppFilter, isPublicChild } from "../src/lib/hosted-page-visibility.ts";
import { loadDashboardPages, pageFilters, pagePresentation } from "../src/lib/dashboard-pages.ts";
import { dashboardStore } from "./helpers/pr5-sqlite.mjs";
import type { PrismaClient } from "@prisma/client";

const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerDirectoryFixtures({ translated: true }), registerSitemapFixtures(), registerPr5PublicFixtures()];
test.after(() => hooks.reverse().forEach(hook => hook.deregister()));
const hosted = await import("../src/app/p/[...segments]/page.tsx");
const layout = await import("../src/app/p/[...segments]/layout.tsx");
const { resolveChildPage } = await import("../src/lib/hosted-page-resolver.ts");
const { loadSiblings } = await import("../src/lib/site-nav.ts");
const { PlatformDirectory } = await import("../src/components/PlatformDirectory.tsx");
const { default: home } = await import("../src/app/[locale]/page.tsx");
const detail = await import("../src/app/[locale]/apps/[id]/page.tsx");
const sitemap = await import("../src/lib/sitemap-data.ts");
const llms = await import("../src/app/llms.txt/route.ts");
const llmsFull = await import("../src/app/llms-full.txt/route.ts");
const form = await import("../src/app/api/v1/form-submit/route.ts");
const order = await import("../src/app/api/v1/simple-order-submit/route.ts");
const issue = await import("../src/app/api/v1/tools/sessions/issue/route.ts");
function reset() { fixtureDb.rows = structuredClone(f1Pages); fixtureDb.apps = structuredClone(f1Apps); fixtureDb.locale = "en"; fixtureSitemapCache.entries.clear(); pr5State.issued = 0; }
const props = (url: string) => ({ params: Promise.resolve({ segments: url.replace(/^\/p\//, "").split("/") }) });
let counter = 0;
const request = (body: unknown) => new NextRequest("https://appai.info/api/v1/fixture", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${++counter}` }, body: JSON.stringify(body) });

test("P2 predicate table matches both query filters and row checks, including foreign roots and empty bindings", () => {
  const roots = f1Pages.filter(page => matchesWhere(page, publicPageWhere()));
  assert.deepEqual(f1Pages.filter(page => isPublicChild(page, roots)).map(p => p.slug), f1Expected.pages);
  assert.deepEqual(f1Pages.filter(page => matchesWhere(page, publicPageWhere(roots))).map(p => p.slug), f1Expected.pages);
  assert.deepEqual(f1Apps.filter(app => matchesWhere(app, publicAppFilter(roots))).map(a => a.id), f1Expected.apps);
});

test("P2 S1: hosted HTML/layout/metadata/nav and direct child resolver agree with the visibility table", async () => {
  reset();
  for (const page of f1Pages) {
    const url = `/p/${page.parentSlug ? page.parentSlug + "/" : ""}${page.slug}`;
    const visible = f1Expected.pages.includes(page.slug);
    if (visible) {
      assert.ok(await renderHtml(await hosted.default(props(url))), url);
      assert.equal((await hosted.generateMetadata(props(url))).title, page.title);
      const chrome = await renderHtml(await layout.default({ ...props(url), children: "fixture body" }));
      assert.ok(chrome.includes("fixture body"));
    } else {
      await assert.rejects(() => hosted.default(props(url)), /404/, `${page.id} ${url}`);
      assert.equal((await hosted.generateMetadata(props(url))).title, undefined);
    }
    if (page.parentSlug) assert.equal(!!await resolveChildPage(page.parentSlug, page.slug, null, page.organizationId), visible);
  }
  assert.deepEqual((await loadSiblings("draft", "org-a", "en")).map(p => p.slug), []);
  assert.deepEqual((await loadSiblings("live", "org-a", "en")).map(p => p.slug), ["live-child"]);
  assert.ok(await hosted.default(props("/p/live/tools/3")));
  await assert.rejects(() => hosted.default(props("/p/draft/tools/3")), /404/);
  // A child's locale must never trigger a root Accept-Language redirect.
  fixtureDb.rows.push(page("redirect-root"), page("redirect-root", { id: "redirect-child", parentSlug: "live", locale: "ja", isDefault: false }));
  fixtureDb.queries.length = 0;
  fixtureDb.acceptLanguage = "ja";
  try { await hosted.default(props("/p/redirect-root")); } finally { fixtureDb.acceptLanguage = ""; }
  assert.ok(fixtureDb.queries.every((query: { where: Record<string, unknown> }) => query.where.parentSlug === null));
});

test("P2 S2–S4: directory/home cards and counts, App details/OG/JSON-LD exclude hidden Apps", async () => {
  reset();
  for (const kind of [undefined, "websites", "tools", "apps"] as const) {
    const html = await renderHtml(await PlatformDirectory({ kind }));
    if (!kind) for (const href of ["/p/live", "/apps/standalone", "/apps/empty"]) assert.ok(html.includes(`href="${href}"`), href);
    for (const app of f1Apps.filter(app => !f1Expected.apps.includes(app.id))) assert.ok(!html.includes(app.name), app.id);
  }
  const html = await renderHtml(await home());
  for (const app of f1Apps) assert.equal(html.includes(app.hostedPageSlug === "live" && app.isApproved ? 'href="/p/live"' : app.name), f1Expected.apps.includes(app.id), app.id);
  assert.ok(html.replace(/<!--.*?-->/g, "").includes("3 pages hosted"), html.match(/<p class="mt-8 text-sm text-gray-500">.*?<\/p>/)?.[0]);
  for (const app of f1Apps) {
    const params = Promise.resolve({ id: app.id, locale: "en" });
    const metadata = await detail.generateMetadata({ params });
    if (f1Expected.apps.includes(app.id)) {
      assert.ok(metadata.openGraph);
      assert.ok((await renderHtml(await detail.default({ params }))).includes('application/ld+json'));
    } else {
      assert.deepEqual(metadata.robots, { index: false });
      assert.equal(metadata.openGraph, undefined);
      await assert.rejects(() => detail.default({ params }), /404/, app.id);
    }
  }
});

test("P2 S5–S6: sitemap pages/Apps and llms root discovery use the same visibility table", async () => {
  reset();
  const entries = (await Promise.all((await sitemap.loadSitemapIds()).map(({ id }) => sitemap.loadSitemapShard(String(id))))).flat();
  for (const row of f1Pages) assert.equal(entries.some(entry => entry.url === `https://appai.info/p/${row.parentSlug ? row.parentSlug + "/" : ""}${row.slug}`), f1Expected.pages.includes(row.slug), row.id);
  for (const app of f1Apps) assert.equal(entries.some(entry => entry.url.endsWith(`/apps/${app.id}`)), ["standalone", "empty"].includes(app.id), app.id);
  const text = await (await llms.GET()).text();
  for (const row of f1Pages) assert.equal(text.includes(`https://appai.info/p/${row.slug} —`), f1Expected.roots.includes(row.slug), row.id);
  assert.equal(await (await llmsFull.GET()).text(), readFileSync(new URL("../AGENT_INSTRUCTIONS.md", import.meta.url), "utf8"));
});

test("P2 S7–S8: handlers reject unpublished roots before delivery or session issuance", async () => {
  reset();
  Object.assign(fixtureDb, { usageEvent: { async count() { return 0; }, async create() { return {}; } } });
  const fetchMock = test.mock.method(globalThis, "fetch", async () => new Response("{}", { status: 200 }));
  const original = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "fixture";
  try {
    for (const row of f1Pages) {
      const expected = f1Expected.interactive.includes(row.slug) ? 200 : 404;
      const base = { pageSlug: row.slug, parentSlug: row.parentSlug, locale: row.locale };
      assert.equal((await form.POST(request({ ...base, sectionOrder: 1, fields: { message: "Fixture" } }))).status, expected, `${row.id} form`);
      assert.equal((await order.POST(request({ ...base, sectionOrder: 2, customer: { name: "Fixture", email: "fixture@example.com" }, preferredDate: "2026-11-12", items: [{ name: "Fixture", quantity: 1, unitPrice: 1 }] }))).status, expected, `${row.id} order`);
      assert.equal((await issue.POST(request({ pageId: row.id, section: 3 }))).status, expected, `${row.id} issue`);
    }
    assert.equal(pr5State.issued, f1Expected.interactive.length);
    assert.equal(fetchMock.mock.callCount(), f1Expected.interactive.length * 2);
  } finally {
    fetchMock.mock.restore();
    if (original === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = original;
  }
});

test("P4: every dashboard View/Privacy/Terms URL resolves to 200; hidden rows have no links", async () => {
  reset();
  const store = dashboardStore(f1Pages);
  try {
    const list = await loadDashboardPages(store as unknown as PrismaClient, "org-a", pageFilters({ created: "all" }), PR5_NOW);
    for (const row of list.groups.flatMap(group => group.pages.flatMap(page => page.variants))) {
      const output = pagePresentation(row, list.roots);
      for (const href of [output.view, output.privacy, output.terms]) if (href) assert.ok(await hosted.default(props(href)), `${row.id}: ${href}`);
      if (!f1Expected.pages.includes(row.slug)) assert.deepEqual([output.view, output.privacy, output.terms], [null, null, null]);
    }
  } finally { store.close(); }
});

test("P4: every locale of all 61 F2 logical pages has the helper URL and a successful GET", async () => {
  fixtureDb.rows = f2Pages();
  fixtureDb.apps = [];
  const store = dashboardStore(f2Pages());
  try {
    const result = await loadDashboardPages(store as unknown as PrismaClient, "org-a", pageFilters({ created: "all" }), PR5_NOW);
    const variants = result.groups.flatMap(group => group.pages.flatMap(page => page.variants));
    assert.equal(variants.length, 61 * 3);
    for (const row of variants) {
      const output = pagePresentation(row, result.roots);
      assert.equal(output.status, "Published");
      assert.ok(output.view, row.id);
      for (const href of [output.view, output.privacy, output.terms]) if (href) assert.ok(await hosted.default(props(href)), `${row.id}: ${href}`);
      if (row.parentSlug) assert.deepEqual([output.privacy, output.terms], [null, null]);
    }
  } finally { store.close(); }
});

test("public read routes cannot reintroduce bare publication/approval queries", () => {
  const paths = ["src/app/p", "src/app/[locale]", "src/components/PlatformDirectory.tsx", "src/lib/hosted-page-resolver.ts", "src/lib/site-nav.ts", "src/lib/sitemap-data.ts", "src/app/llms.txt", "src/app/api/v1/form-submit", "src/app/api/v1/simple-order-submit", "src/app/api/v1/tools/sessions/issue"];
  function scan(path: string) {
    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) { for (const item of readdirSync(path)) scan(join(path, item)); return; }
    assert.doesNotMatch(readFileSync(path, "utf8"), /is(?:Published|Approved): true/, path);
  }
  paths.forEach(scan);
});


test("PR-5a locale edge: S1, S7/S8 and dashboard agree when only en root is published", async () => {
  fixtureDb.rows = localeEdge.map(row => ({ ...row, content: interactionContent }));
  const fetchMock = test.mock.method(globalThis, "fetch", async () => new Response("{}", {status:200}));
  const original = process.env.RESEND_API_KEY; process.env.RESEND_API_KEY="fixture";
  Object.assign(fixtureDb, {usageEvent:{async count(){return 0;},async create(){return {};}}});
  try {
    for(const row of fixtureDb.rows.filter(row=>row.parentSlug)) {
      const expected=row.locale==="en"?200:404;
      const base={pageSlug:row.slug,parentSlug:row.parentSlug,locale:row.locale};
      assert.equal((await form.POST(request({...base,sectionOrder:1,fields:{message:"Fixture"}}))).status,expected);
      assert.equal((await order.POST(request({...base,sectionOrder:2,customer:{name:"Fixture",email:"fixture@example.com"},preferredDate:"2026-11-12",items:[{name:"Fixture",quantity:1,unitPrice:1}]}))).status,expected);
      assert.equal((await issue.POST(request({pageId:row.id,section:3}))).status,expected);
    }
    assert.ok(await hosted.default(props("/p/locale-root/locale-child")));
    await assert.rejects(()=>hosted.default(props("/p/locale-root/ja/locale-child")),/404/);
  } finally {fetchMock.mock.restore();if(original===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=original;}
});

test("P12 first public origin reads after removal omit the tree from all discovery surfaces", async () => {
  reset();
  const store=managementStore(f1Pages.map(row=>managedPage(row.slug,row)));
  fixtureDb.rows=store.rows;
  // Warm actual cached sitemap wrappers, then expire their shared tag after commit.
  await sitemap.loadSitemapIds();
  await managePages(store as unknown as PrismaClient,{kind:"user",userId:"owner",organizationId:"org-a"},{action:"delete",targets:["live-en"],expected:{pages:3,rows:3}});
  fixtureDb.rows=store.rows;
  const {revalidateSeoIndexes}=await import("../src/lib/revalidate-seo.ts");
  assert.equal(revalidateSeoIndexes("live"),true);
  await assert.rejects(()=>hosted.default(props("/p/live")),/404/);
  await assert.rejects(()=>hosted.default(props("/p/live/live-child")),/404/);
  const entries=(await Promise.all((await sitemap.loadSitemapIds()).map(({id})=>sitemap.loadSitemapShard(String(id))))).flat();
  assert.ok(!entries.some(entry=>entry.url.includes("/p/live")));
  assert.doesNotMatch(await (await llms.GET()).text(),/https:\/\/appai.info\/p\/live —/);
  for(const html of [await renderHtml(await PlatformDirectory({})),await renderHtml(await home())])assert.ok(!html.includes('href="/p/live"'));
  await assert.rejects(()=>detail.default({params:Promise.resolve({id:"live-app",locale:"en"})}),/404/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { registerHostedRenderLoader, registerSitemapFixtures, fixtureDb, fixtureSitemapCache } from "./helpers/hosted-render-loader.mjs";
import { buildSitemapEntries, SITEMAP_CACHE_BYTE_LIMIT } from "../src/lib/sitemap-entries.ts";

const hooks = registerHostedRenderLoader();
const cacheHooks = registerSitemapFixtures();
test.after(() => { cacheHooks.deregister(); hooks.deregister(); });

test("runtime sitemap index and new shard IDs stay reachable after the directory grows, with bounded per-shard caches", async () => {
  const index = await import("../src/app/sitemap.xml/route.ts");
  const shard = await import("../src/app/sitemaps/sitemap/[id]/route.ts");
  const { writes, entries: cache } = fixtureSitemapCache;
  assert.equal(index.dynamic, "force-dynamic");
  assert.equal(shard.dynamic, "force-dynamic");
  const readShard = (id: string) => shard.GET(new Request(`https://appai.info/sitemaps/sitemap/${id}`), { params: Promise.resolve({ id }) });
  fixtureDb.rows = [];
  fixtureDb.apps = [];
  const initial = await (await index.GET()).text();
  assert.equal([...initial.matchAll(/<loc>/g)].length, 1);
  assert.equal((await readShard("0.xml")).status, 200);

  // Add enough real entries to exceed a single 2 MB Next data-cache item.
  const updatedAt = new Date("2025-04-01T12:00:00Z");
  const rows = Array.from({ length: 10_000 }, (_, id) => ({
    slug: `runtime-page-${id}`, parentSlug: null, organizationId: "fixture", locale: "en",
    isDefault: true, isPublished: true, updatedAt,
  }));
  fixtureDb.rows = rows;
  const expected = buildSitemapEntries(rows, []);
  assert.ok(Buffer.byteLength(JSON.stringify(expected)) > 2 * 1024 * 1024);
  cache.clear(); // Publishing invalidates the shared seo-sitemap tag in production.
  const response = await index.GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type")!, /application\/xml/);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
  assert.ok(urls.length > 1);
  assert.ok(urls.some(url => url.pathname === "/sitemaps/sitemap/1.xml"));
  const found: string[] = [];
  for (const url of urls) {
    const file = await readShard(url.pathname.split("/").at(-1)!);
    assert.equal(file.status, 200, url.pathname);
    const body = await file.text();
    assert.match(body, /<urlset\b/);
    assert.match(body, /<lastmod>/);
    assert.match(body, /<xhtml:link rel="alternate"/);
    const entries = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    assert.ok(entries.length <= 45_000);
    found.push(...entries);
  }
  assert.deepEqual(found, expected.map(entry => entry.url));
  const beyond = await readShard(`${urls.length}.xml`);
  assert.equal(beyond.status, 200);
  assert.doesNotMatch(await beyond.text(), /<url>/);
  for (const id of ["-1.xml", "01.xml", "1.5.xml", "1", "999999999999999999999.xml"]) {
    assert.equal((await readShard(id)).status, 404);
  }
  assert.ok(writes.some((write: { keys: string[]; args: string[] }) => write.keys[0] === "seo-sitemap-shard" && write.args[0] === "1"));
  for (const write of writes) {
    assert.ok(write.bytes <= SITEMAP_CACHE_BYTE_LIMIT, JSON.stringify(write));
    assert.deepEqual(write.options, { revalidate: 3600, tags: ["seo-sitemap"] });
  }
});

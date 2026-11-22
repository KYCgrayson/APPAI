import assert from "node:assert/strict";
import test from "node:test";
import { projectCardsItems, resolveProjectCardsPagination } from "../src/lib/project-cards.ts";
import { createPageSchema, updatePageSchema } from "../src/lib/validations/page.ts";
import { fixtureDb, fixtureSitemapCache, registerHostedHeaders, registerHostedRenderLoader, registerSitemapFixtures } from "./helpers/hosted-render-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { page } from "./fixtures/pr5-pages.ts";

const items = [
  { name: "Undated" },
  { name: "Original tie first", date: "2026-11-22", publishedAt: "2026-11-22T08:00:00+08:00" },
  { name: "Older date", date: "2026-11-21", publishedAt: "2026-11-23T00:00:00Z" },
  { name: "Original tie second", date: "2026-11-22", publishedAt: "2026-11-22T00:00:00.000Z" },
  { name: "No timestamp", date: "2026-11-22" },
  { name: "Later instant", date: "2026-11-22", publishedAt: "2026-11-22T00:00:00.0001Z" },
  { name: "Undated with timestamp", publishedAt: "2026-11-24T00:00:00Z" },
];

test("date-desc sorts by calendar date, time, and original order without mutating items", () => {
  assert.equal(projectCardsItems({ items }), items);
  assert.deepEqual(projectCardsItems({ items, sort: "date-desc" }), [
    items[5], items[1], items[3], items[4], items[2], items[6], items[0],
  ]);
  assert.equal(items[0].name, "Undated");
});

const episodes = Array.from({ length: 25 }, (_, i) => ({
  name: `Episode ${i + 1}`,
  date: `2026-11-${String(i + 1).padStart(2, "0")}`,
  featured: i === 24 || i === 14,
  href: i === 14 ? "?t=90#video" : `https://example.test/episode-${i + 1}`,
}));
const archive = { type: "project-cards", order: 1,
  data: { layout: "feed", sort: "date-desc", pagination: { defaultSize: 10 }, items: episodes } };
const weekly = { type: "project-cards", order: 0,
  data: { layout: "feed", items: [{ name: "Weekly digest", featured: true, href: "?t=92#video" }] } };
const sections = [archive, weekly];

test("validation rejects invalid dates, instants, sizes, sorts and a second paginated section", () => {
  const payload = { slug: "pagination-fixture", title: "Pagination fixture", content: { sections } };
  assert.ok(createPageSchema.safeParse(payload).success);
  for (const [data, field] of [
    [{ ...archive.data, items: [{ name: "Bad", date: "2026-02-30" }] }, "items[0].date"],
    [{ ...archive.data, items: [{ name: "Bad", publishedAt: "2026-11-22" }] }, "items[0].publishedAt"],
    [{ ...archive.data, pagination: { defaultSize: 15 } }, "pagination.defaultSize"],
    [{ ...archive.data, sort: "date-asc" }, "sort"],
  ] as const) {
    const invalid = createPageSchema.safeParse({ ...payload, content: { sections: [{ ...archive, data }] } });
    assert.ok(!invalid.success);
    assert.ok(invalid.error.issues.some(issue => issue.message.includes(`sections[0].data.${field}`)));
  }
  const duplicate = { content: { sections: [archive, { ...weekly, data: { ...weekly.data, pagination: { defaultSize: 20 } } }] } };
  for (const result of [createPageSchema.safeParse({ ...payload, ...duplicate }), updatePageSchema.safeParse(duplicate)]) {
    assert.ok(!result.success);
    assert.ok(result.error.issues.some(issue => issue.message.includes("sections[1].data.pagination")));
  }
});

test("pagination supports both defaults, falls back on invalid sizes, and gives an empty archive one page", () => {
  const twenty = [{ ...archive, data: { ...archive.data, pagination: { defaultSize: 20 } } }];
  for (const size of [undefined, "15", ["10", "20"]]) {
    const pagination = resolveProjectCardsPagination(twenty, { page: "2", size });
    assert.ok(pagination);
    assert.equal(pagination.size, 20);
    assert.equal(pagination.noindex, false);
    assert.deepEqual(projectCardsItems(twenty[0].data, pagination), episodes.slice(0, 5).reverse());
  }
  assert.equal(resolveProjectCardsPagination(twenty, { page: "3" }), null);
  assert.equal(resolveProjectCardsPagination(twenty, { size: "20" })?.noindex, true);
  assert.equal(resolveProjectCardsPagination(twenty, { size: "10", page: "3" })?.canonicalPage, 2);
  const empty = [{ ...archive, data: { ...archive.data, items: [] } }];
  assert.equal(resolveProjectCardsPagination(empty, {})?.pageCount, 1);
  assert.equal(resolveProjectCardsPagination(empty, { page: "2" }), null);
});

const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerSitemapFixtures()];
test.after(() => hooks.reverse().forEach(hook => hook.deregister()));
const { default: HostedPage, generateMetadata } = await import("../src/app/(legacy)/p/[...segments]/page.tsx");

test("hosted route slices the archive after cache read and keeps links, SEO and breadcrumbs in sync", async () => {
  fixtureDb.rows = [page("pagination-fixture", { content: { sections } })];
  const path = "/p/pagination-fixture";
  const params = Promise.resolve({ segments: ["pagination-fixture"] });
  for (const [query, canonicalQuery, names, noindex] of [
    [{ page: "1" }, "", [25, 16], false],
    [{ page: "2", size: "bogus" }, "?page=2", [15, 6], false],
    [{ size: "20" }, "", [25, 6], true],
    [{ page: "2", size: "20" }, "?page=3", [5, 1], true],
  ] as const) {
    const props = { params, searchParams: Promise.resolve(query) };
    const canonical = `https://appai.info${path}${canonicalQuery}`;
    const metadata = await generateMetadata(props);
    assert.equal(metadata.alternates?.canonical, canonical);
    assert.equal(metadata.openGraph?.url, canonical);
    assert.deepEqual(metadata.robots, noindex ? { index: false, follow: true } : undefined);
    const html = await renderHtml(await HostedPage(props));
    const cards = [...html.matchAll(/<h2[^>]*><a[^>]*>Episode (\d+)<\/a><\/h2>/g)].map(match => Number(match[1]));
    assert.deepEqual(cards, Array.from({ length: names[0] - names[1] + 1 }, (_, i) => names[0] - i));
    assert.match(html, /Weekly digest/);
    assert.equal((html.match(/data-featured="true"/g) ?? []).length, query.page === "2" ? 1 : 2);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1])["@graph"];
    assert.equal(graph[0].url, canonical);
    assert.equal(graph.find((entry: { "@type": string }) => entry["@type"] === "BreadcrumbList").itemListElement.at(-1).item, canonical);
    assert.deepEqual(graph.filter((entry: { "@type": string }) => entry["@type"] === "ItemList")[0].itemListElement.map((item: { name: string }) => item.name), cards.map(number => `Episode ${number}`));
    if (query.page === "2" && query.size === "bogus") {
      assert.ok(html.includes(`href="${path}" rel="prev"`));
      assert.ok(html.includes(`href="${path}?page=3" rel="next"`));
      assert.ok(html.includes(`href="${path}?page=2" aria-label="Page 2" aria-current="page"`));
      assert.ok(html.includes(`href="${path}?size=20"`));
      assert.ok(html.includes('href="?page=2&amp;size=bogus&amp;t=90#video"'));
      assert.ok(html.includes('href="?page=2&amp;size=bogus&amp;t=92#video"'));
      assert.equal(graph[2].itemListElement[0].url, `https://appai.info${path}?page=2&t=90#video`);
    }
  }
  const writes = fixtureSitemapCache.writes.filter(entry => entry.keys.includes("hosted-page-root-v2"));
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].options.tags, ["hosted-page"]);
  for (const query of [{ page: "4" }, { page: "3", size: "20" }, { page: "0" }, { page: "2.5" }, { page: ["1", "2"] }]) {
    const props = { params, searchParams: Promise.resolve(query) };
    await assert.rejects(() => HostedPage(props), /NEXT_HTTP_ERROR_FALLBACK;404/);
    await assert.rejects(() => generateMetadata(props), /NEXT_HTTP_ERROR_FALLBACK;404/);
  }
});

test("publisher canonicals apply to the first page while later pages use the hosted URL", async () => {
  const video = { type: "video", order: 2, data: {
    id: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", heading: "Episode trailer",
    moments: [{ t: 92, title: "Introduction" }],
  } };
  fixtureDb.rows = [page("canonical-archive", { content: { sections: [...sections, video] }, canonicalUrl: "https://example.test/archive?source=publisher#top" })];
  const params = Promise.resolve({ segments: ["canonical-archive"] });
  const first = await generateMetadata({ params, searchParams: Promise.resolve({ size: "20" }) });
  const second = await generateMetadata({ params, searchParams: Promise.resolve({ page: "2" }) });
  assert.equal(first.alternates?.canonical, "https://example.test/archive");
  assert.equal(second.alternates?.canonical, "https://appai.info/p/canonical-archive?page=2");
  for (const [query, seek] of [
    [{}, "?t=92#video"],
    [{ page: "2", size: "20" }, "?page=2&size=20&t=92#video"],
  ] as const) {
    const html = await renderHtml(await HostedPage({ params, searchParams: Promise.resolve(query) }));
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    const clip = schemas.find(schema => schema["@type"] === "VideoObject")?.hasPart[0];
    assert.equal(clip?.url, `https://appai.info/p/canonical-archive${seek}`);
  }
});

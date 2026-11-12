import test from "node:test";
import assert from "node:assert/strict";
import { loadDashboardPages, pageFilters, pagePresentation, dashboardPagesHref } from "../src/lib/dashboard-pages.ts";
import { hostedPagePath } from "../src/lib/hosted-page-urls.ts";
import { dashboardStore } from "./helpers/pr5-sqlite.mjs";
import { f2Pages, page, PR5_NOW, ago } from "./fixtures/pr5-pages.ts";
import type { PrismaClient } from "@prisma/client";
const storeFor = (rows: ReturnType<typeof f2Pages>) => dashboardStore(rows);
const load = (store: ReturnType<typeof storeFor>, search = {}) => loadDashboardPages(store as unknown as PrismaClient, "org-a", pageFilters(search), PR5_NOW);

test("P3: inclusive UTC 30-day boundary, all locales, old root heading, organisation isolation", async () => {
  const store = storeFor(f2Pages());
  try {
    const result = await load(store);
    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].title, "Older root");
    const pages = result.groups.flatMap(group => group.pages);
    assert.deepEqual(pages.map(page => page.slug), Array.from({ length: 16 }, (_, i) => `recent-${String(i).padStart(3, "0")}`));
    assert.ok(pages.every(page => page.variants.length === 3 && page.variants[0].isDefault));
    assert.equal(result.nextCursor, null);
    assert.ok(store.queries[1].includes('AS "hasPrivacy"'));
    assert.ok(!store.queries[1].includes('"content"'));
    assert.equal((await load(store, { created: "7d" })).groups[0].pages.length, 4);
    assert.equal((await load(store, { created: "90d" })).groups[0].pages.length, 46);
    assert.equal((await load(store, { created: "all" })).groups[0].pages.length, 61);
  } finally { store.close(); }
});

test("P3: case-insensitive title in any locale or slug; literal wildcard search; logical creation date", async () => {
  const rows = f2Pages();
  rows.push(page("literal", { title: "100%_complete", createdAt: ago(1) }));
  rows.push(page("recent-059", { id: "recent-059-es", locale: "es", parentSlug: "recent", isDefault: false, title: "new translation", createdAt: ago(0) }));
  const store = storeFor(rows);
  try {
    assert.deepEqual((await load(store, { q: "tRaNsLaTeD 15" })).groups[0].pages.map(p => p.slug), ["recent-015"]);
    assert.deepEqual((await load(store, { q: "RECENT-014" })).groups[0].pages.map(p => p.slug), ["recent-014"]);
    assert.equal((await load(store, { q: "new translation" })).groups.length, 0);
    assert.deepEqual((await load(store, { q: "%_" })).groups[0].pages.map(p => p.slug), ["literal"]);
    assert.equal((await load(store, { q: "' OR 1=1 --" })).groups.length, 0);
  } finally { store.close(); }
});

test("P3: 250 children / 750 locale rows page without duplicates, ties, caps or lost filters", async () => {
  const store = storeFor(f2Pages(true));
  try {
    let cursor: string | null = null;
    const union: string[] = [];
    const sizes: number[] = [];
    do {
      const result = await load(store, { created: "all", q: "large-", status: "published", ...(cursor ? { cursor } : {}) });
      const pages = result.groups.flatMap(group => group.pages);
      sizes.push(pages.length);
      assert.equal(result.groups[0].continued, union.length > 0);
      assert.ok(pages.every(page => page.variants.length === 3));
      union.push(...pages.map(page => page.slug));
      cursor = result.nextCursor;
      if (cursor) {
        const url = new URL(dashboardPagesHref(pageFilters({ q: "large-", created: "all", status: "published" }), cursor), "https://example.com");
        assert.equal(url.searchParams.get("q"), "large-");
        assert.equal(url.searchParams.get("cursor"), cursor);
      }
    } while (cursor);
    assert.deepEqual(sizes, [100, 100, 50]);
    assert.equal(union.length, new Set(union).size);
    assert.deepEqual([...union].sort(), Array.from({ length: 250 }, (_, i) => `large-${String(i).padStart(3, "0")}`));
  } finally { store.close(); }
});

test("P4: published, draft, hidden and mixed locales; only reachable URLs, root-only policies", async () => {
  const rows = [page("labels"), page("labels", { id: "labels-ja", locale: "ja", isDefault: false, isPublished: false }),
    page("child", { parentSlug: "labels", locale: "fr", isDefault: false }),
    page("default-child", { parentSlug: "labels", locale: "fr" }),
    page("hidden-root", { isPublished: false }), page("hidden", { parentSlug: "hidden-root" })];
  const store = storeFor(rows);
  try {
    const result = await load(store, { created: "all" });
    const expected: Record<string, [string, string | null]> = {
      "labels-en": ["Published", "/p/labels"], "labels-ja": ["Draft", null],
      "child-en": ["Published", null], "default-child-en": ["Published", "/p/labels/default-child"],
      "hidden-root-en": ["Draft", null], "hidden-en": ["Hidden — root not public", null],
    };
    for (const row of result.groups.flatMap(g => g.pages.flatMap(p => p.variants))) {
      const output = pagePresentation(row, result.roots);
      assert.deepEqual([output.status, output.view], expected[row.id], row.id);
      if (output.view) assert.equal(output.view, hostedPagePath(row, result.roots.filter(r => r.isPublished)));
      assert.equal(!!output.privacy, row.id === "labels-en");
      assert.equal(!!output.terms, row.id === "labels-en");
    }
    assert.equal((await load(store, { status: "unpublished" })).groups.flatMap(g => g.pages).length, 1);
    assert.equal((await load(store, { status: "published" })).groups.flatMap(g => g.pages).length, 4);
  } finally { store.close(); }
});

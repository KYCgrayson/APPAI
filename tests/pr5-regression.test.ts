import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHostedRenderLoader, registerHostedHeaders, registerDirectoryFixtures, registerSitemapFixtures, fixtureDb, fixtureSitemapCache } from "./helpers/hosted-render-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { page } from "./fixtures/pr5-pages.ts";
import { captureF0 } from "./helpers/pr5-capture.mjs";
const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerDirectoryFixtures({ translated: true }), registerSitemapFixtures()];
test.after(() => hooks.reverse().forEach(hook => hook.deregister()));
test("P1: consistent F0 data preserves publisher HTML for 12 URLs, sitemap shards and llms", async () => {
  // Captured from 557445a with main's slug_locale index order for tied/unordered fixture reads.
  // The original snapshot used insertion order (zh-TW before zh-CN), masking the planner regression.
  const { source, ...expected } = JSON.parse(readFileSync(new URL("./fixtures/pr5-f0-baseline.json", import.meta.url), "utf8"));
  assert.match(source, /557445a/);
  assert.equal(Object.keys(expected.html).length, 12);
  // #91 intentionally changes shared header/footer navigation. Compare the
  // unchanged publisher <main> against a separately captured main baseline,
  // preserving the historical full-page snapshot above and SEO checks below.
  const publisher = JSON.parse(readFileSync(new URL("./fixtures/pr5-f0-publisher-baseline.json", import.meta.url), "utf8"));
  assert.match(publisher.source, /949fda4/);
  assert.deepEqual(await captureF0({ publisherOnly: true }), { ...expected, html: publisher.html });
});

test("P1: hreflangs and language switchers retain main's en, ja, zh-CN, zh-TW order regardless of scan order", async () => {
  const hosted = await import("../src/app/p/[...segments]/page.tsx");
  const { default: layout } = await import("../src/app/p/[...segments]/layout.tsx");
  const { loadSitemapIds, loadSitemapShard } = await import("../src/lib/sitemap-data.ts");
  const { hostedAlternates } = await import("../src/lib/hosted-page-urls.ts");
  // Verified by rendering main and pre-PR 557445a with fixture reads emulating slug_locale index order.
  const locales = ["en", "ja", "zh-CN", "zh-TW"];
  const languages = ["en", "x-default", "ja", "zh-CN", "zh-TW"];
  for (const scan of [["en", "zh-TW", "zh-CN", "ja"], ["zh-TW", "ja", "zh-CN", "en"]]) {
    fixtureDb.rows = scan.flatMap(locale => [
      page("ordered", { id: `ordered-${locale}`, locale, isDefault: locale === "en" }),
      page("ordered-child", { id: `ordered-child-${locale}`, parentSlug: "ordered", locale, isDefault: locale === "en" }),
    ]);
    fixtureDb.apps = [];
    for (const suffix of ["", "/ordered-child", "/privacy", "/terms"]) {
      const props = { params: Promise.resolve({ segments: `ordered${suffix}`.split("/") }) };
      const metadata = await hosted.generateMetadata(props);
      assert.deepEqual(Object.keys(metadata.alternates!.languages!), languages, suffix);
      const html = await renderHtml(await layout({ ...props, children: null }));
      const switcher = html.match(/<div class="hidden md:flex items-center gap-1 text-sm[^"]*">([\s\S]*?)<\/div>/)![1];
      const hrefs = [...switcher.matchAll(/<a href="([^"]+)"/g)].map(match => match[1]);
      assert.deepEqual(hrefs, locales.map(locale => `/p/ordered${locale === "en" ? "" : `/${locale}`}${suffix}`), suffix);
    }
    const roots = fixtureDb.rows.filter(row => !row.parentSlug) as ReturnType<typeof page>[];
    assert.deepEqual(Object.keys(hostedAlternates(roots, roots)), languages);
    fixtureSitemapCache.entries.clear();
    const entries = (await Promise.all((await loadSitemapIds()).map(({ id }) => loadSitemapShard(String(id))))).flat();
    for (const entry of entries.filter(entry => entry.url.includes("/p/ordered"))) {
      assert.deepEqual(Object.keys(entry.alternates!.languages!), languages, entry.url);
    }
  }
});

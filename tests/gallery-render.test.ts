import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { registerGalleryCss } from "./helpers/gallery-render.mjs";
import { registerHostedRenderLoader, registerDirectoryFixtures, fixtureDb } from "./helpers/hosted-render-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { buildJsonLd, hostedOgImage } from "../src/lib/hosted-page-seo.ts";
const loader = registerHostedRenderLoader();
const fixtures = registerDirectoryFixtures();
const css = registerGalleryCss();
test.after(() => { css.deregister(); fixtures.deregister(); loader.deregister(); });
const { GallerySection } = await import("../src/templates/sections/GallerySection.tsx");
const { GET: llms } = await import("../src/app/llms.txt/route.ts");
const render = (data: unknown, extra = {}) => renderHtml(createElement(GallerySection, { themeColor: "#2563eb", data: data as never, ...extra }));
const items = Array.from({ length: 7 }, (_, i) => ({ url: `https://example.com/frame-${i}.png`, caption: `Moment ${i}`, alt: `Paper bridge ${i}`, href: `?t=${104 + i}#video`, badge: `1:${44 + i}` }));

function assertNoNestedAnchors(html: string) {
  let depth = 0;
  for (const match of html.matchAll(/<\/?a(?:\s[^>]*|)>/g)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    assert.ok(depth === 0 || depth === 1);
  }
  assert.equal(depth, 0);
}

test("fixed pre-change mixed image/video fixtures remain byte-identical, including headings and typography", async () => {
  const baseline = JSON.parse(readFileSync(new URL("./fixtures/gallery-masonry.json", import.meta.url), "utf8"));
  for (const { html, data, ...props } of baseline.fixtures) {
    assert.equal(await render(data, props), html);
    assert.equal(await render({ ...data, layout: "masonry" }, props), html);
    assert.equal(await render({ ...data, aspect: "4:5", columns: 4 }, props), html, "grid-only knobs do not change masonry");
  }
});

test("grid preserves DOM order, reserves aspect boxes, links image and caption once and lazily loads beyond its first desktop row", async () => {
  for (const columns of [2, 3, 4]) for (const [aspect, className] of [["16:9", "wide"], ["1:1", "square"], ["4:3", "landscape"], ["4:5", "portrait"]]) {
    const html = await render({ layout: "grid", columns, aspect, items }, { typographyActive: true });
    assertNoNestedAnchors(html);
    assert.equal((html.match(/<a\b/g) || []).length, items.length);
    assert.match(html, new RegExp(`--gallery-columns:${columns};--gallery-tablet-columns:${Math.min(columns, 3)}`));
    const tiles = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(m => m[0]);
    tiles.forEach((tile, i) => {
      assert.match(tile, new RegExp(`src="https://example.com/frame-${i}.png"`));
      assert.ok(tile.includes(`href="?t=${104 + i}#video"`));
      assert.ok(tile.includes(`aria-label="1:${44 + i} — Moment ${i}"`));
      assert.ok(tile.includes(`alt="Paper bridge ${i}"`));
      assert.ok(tile.includes(`loading="${i < columns ? "eager" : "lazy"}"`));
      assert.ok(tile.includes(`class="media ${className}"`));
      assert.match(tile, /data-typography-role="caption" class="caption"/);
      assert.doesNotMatch(tile, /aria-hidden|<video|<button/);
    });
  }
  const defaults = await render({ layout: "grid", items });
  assert.match(defaults, /--gallery-columns:3/); assert.match(defaults, /class="media wide"/);
});

test("unlinked masonry keeps its structure; explicit alt, badges, safe links and native controls are additive", async () => {
  const html = await render({ items: [
    { url: "https://example.com/alt.png", alt: "Real description", caption: "Visible caption" },
    { url: "https://example.com/empty.png", alt: "", badge: "  New  " },
    { url: "https://example.com/fallback.png", href: "#moments", badge: "Day 2" },
    { url: "https://example.com/video.mp4", type: "video", href: "#moments", badge: "Recap" },
    { url: "https://example.com/external.png", href: "HTTPS://Example.com/Case?Q=A#ID", alt: "External session" },
    ...["javascript:alert(1)", "HtTp://example.com", "//example.com"].map(href => ({ url: "https://example.com/unsafe.png", href })),
  ] });
  assertNoNestedAnchors(html);
  assert.match(html, /alt="Real description" class="w-full"\/><p/);
  assert.match(html, /alt="" class="w-full"/);
  assert.match(html, /class="badge" title="New">New<\/span>/);
  assert.match(html, /class="[^"]*badged"><img[^>]*alt=""[^>]*\/><span/, "unlinked masonry badges keep the image directly in the original tile");
  assert.match(html, /aria-label="Day 2 — Gallery item 3"/);
  assert.match(html, /<video class="w-full" controls="">/);
  assert.match(html, /href="https:\/\/Example.com\/Case\?Q=A#ID" target="_blank" rel="noreferrer"/);
  assert.equal((html.match(/<a\b/g) || []).length, 2);
  assert.doesNotMatch(html, /loading=|aria-hidden|javascript:|HtTp:|href="\/\//);
  const gridVideo = await render({ layout: "grid", items: [{ url: "https://example.com/recap.mp4", type: "video", badge: "Recap" }] });
  assert.match(gridVideo, /<video class="video" controls="" preload="none">/);
  assert.doesNotMatch(gridVideo, /<a\b/);
});

test("CSS provides responsive ordered rows, cover images, inherited caption colour, full badge text and theme focus", () => {
  const css = readFileSync(new URL("../src/templates/sections/gallery.module.css", import.meta.url), "utf8");
  assert.match(css, /\.grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /min-width: 768px.*--gallery-tablet-columns/);
  assert.match(css, /min-width: 1024px.*--gallery-columns/);
  assert.match(css, /\.image \{ object-fit: cover/);
  assert.match(css, /\.link:focus-visible \{ outline: 3px solid var\(--gallery-accent\)/);
  assert.match(css, /\.badge \{[^}]*max-width: 40%[^}]*text-overflow: ellipsis[^}]*background: #171717; color: #fff/);
  assert.match(css, /\.caption \{[^}]*color: inherit[^}]*-webkit-line-clamp: 2/);
});

test("gallery continues to add no ImageGallery/ItemList, OG fallback or llms item listings", async () => {
  const page = { title: "Workshop recap", locale: "en", content: { sections: [{ type: "gallery", data: { layout: "grid", items } }] } };
  const graph = buildJsonLd(page, "https://appai.info/p/workshop", "https://appai.info", null)["@graph"];
  assert.ok(graph.every(entry => !["ImageGallery", "ItemList"].includes(entry["@type"])));
  assert.equal(hostedOgImage(page), undefined);
  fixtureDb.rows = [{ id: "workshop", slug: "workshop", locale: "en", title: "Workshop recap", tagline: null, updatedAt: new Date("2026-01-01"), isDefault: true, isPublished: true, deletedAt: null, adminUnpublishedAt: null, parentSlug: null, content: page.content }];
  const text = await (await llms()).text();
  assert.match(text, /Workshop recap/); assert.doesNotMatch(text, /Moment 0|\?t=104#video/);
});

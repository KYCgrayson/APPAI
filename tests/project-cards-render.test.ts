import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerProjectCardCss } from "./helpers/project-cards-render.mjs";
import { createElement } from "react";
import { registerHostedRenderLoader, registerDirectoryFixtures, fixtureDb } from "./helpers/hosted-render-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { buildJsonLd, hostedOgImage } from "../src/lib/hosted-page-seo.ts";
const loader = registerHostedRenderLoader();
const fixtures = registerDirectoryFixtures();
const css = registerProjectCardCss();
test.after(() => { css.deregister(); fixtures.deregister(); loader.deregister(); });
const { ProjectCardsSection } = await import("../src/templates/sections/EditorialSections.tsx");
const { PageRenderer } = await import("../src/templates/shared/PageRenderer.tsx");
const { GET: llms } = await import("../src/app/llms.txt/route.ts");
const render = (data: unknown, extra = {}) => renderHtml(createElement(ProjectCardsSection, { themeColor: "#b0461f", data: data as never, ...extra }));
const media = [{ url: "https://example.com/one.png", alt: "Episode artwork", href: "?t=1:30#video", label: "6 key moments" }, { url: "https://example.com/two.png", alt: "", href: "#moments", aspect: "1:1" }];
const data = { layout: "feed", heading: "Episode feed", items: [
  { name: "The Paper Observatory", href: "/p/fictional-feed?t=90#video", meta: [" Episode 12 ", "8 min"], monogram: "PO", description: "First line\nSecond line", media, links: [{ label: "Transcript", url: "/p/transcript" }, { label: "Subscribe", url: "https://example.com/subscribe" }] },
  { name: "Featured episode", featured: true, category: "Podcast", icon: { url: "https://example.com/icon.png", alt: "" }, media },
  { name: "Later featured flag", featured: true, category: "Archive", media: [media[0]] },
] };

function assertNoNestedAnchors(html: string) {
  let depth = 0;
  for (const match of html.matchAll(/<\/?a(?:\s[^>]*|)>/g)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    assert.ok(depth === 0 || depth === 1, match[0]);
  }
  assert.equal(depth, 0);
}

test("fixed pre-change fixtures remain byte-identical in omitted and explicit grid layouts", async () => {
  const baseline = JSON.parse(readFileSync(new URL("./fixtures/project-cards-grid.json", import.meta.url), "utf8"));
  for (const { html, data, ...props } of baseline.fixtures) {
    assert.equal(await render(data, props), html);
    assert.equal(await render({ ...data, layout: "grid" }, props), html);
    assert.equal(await render({ ...data, items: data.items?.map((item: object | null) => item ? { ...item, featured: true, media } : item) }, props), html, "media and featured do not change grid");
  }
});

test("feed SSR has ordered metadata/copy/media/links, no nested links, alt text, badges and first-card eager images", async () => {
  for (const darkMode of [false, true]) {
    const html = await render(data, { darkMode, typographyActive: true });
    assertNoNestedAnchors(html);
    assert.match(html, /Episode 12 · 8 min/);
    assert.match(html, /First line\nSecond line/);
    assert.equal((html.match(/data-featured="true"/g) || []).length, 1);
    const cards = html.split('<article ').slice(1);
    assert.doesNotMatch(cards[0], /loading="lazy"/);
    assert.match(cards[1], /data-featured="true"/);
    assert.doesNotMatch(cards[2], /data-featured=/);
    assert.match(cards[0], /href="\?t=1:30#video"/);
    assert.match(cards[0], /aria-label="The Paper Observatory"/);
    assert.match(cards[0], /6 key moments/);
    assert.match(cards[0], /aspect-ratio:16 \/ 9/);
    assert.match(cards[0], /aspect-ratio:1 \/ 1/);
    for (const card of cards.slice(1)) for (const tag of card.matchAll(/<img\b[^>]+>/g)) assert.match(tag[0], /loading="lazy"/);
    for (const tag of html.matchAll(/<img\b[^>]+>/g)) assert.match(tag[0], /alt="[^"]*"/);
    assert.ok(cards[0].indexOf('class="feedMeta"') < cards[0].indexOf('<h3'));
    assert.ok(cards[0].indexOf('<h3') < cards[0].indexOf('class="feedDescription"'));
    assert.ok(cards[0].indexOf('class="feedDescription"') < cards[0].indexOf('class="feedMedia"'));
    assert.ok(cards[0].indexOf('class="feedMedia"') < cards[0].indexOf('class="feedLinks"'));
    assert.match(cards[0], /<span aria-hidden="true"> · <\/span>/);
    assert.match(html, new RegExp(`data-dark="${darkMode}"`));
  }
});

test("feed maps legacy category/screenshot/icon and distinguishes absent meta/media from explicit arrays", async () => {
  const item = { name: "Example", category: "Podcast", monogram: "EX", screenshot: { url: "https://example.com/legacy.png", alt: "Legacy frame", kind: "phone" }, description: "<script>fictional</script>" };
  const html = await render({ layout: "feed", items: [item] });
  assert.match(html, /<h2/); assert.match(html, /Podcast/); assert.match(html, />EX<\/span>/);
  assert.match(html, /<figure[^>]*aspect-ratio:16 \/ 9/);
  assert.match(html, /alt="Legacy frame" loading="eager"/);
  assert.doesNotMatch(html, /<script>/);
  const override = await render({ layout: "feed", items: [{ ...item, meta: [], media: [media[0]] }] });
  assert.doesNotMatch(override, /Podcast|legacy.png/);
  const unsafe = await render({ layout: "feed", items: [{ ...item, href: "javascript:evil", media: [{ ...media[0], url: "data:image/svg+xml,bad" }] }] });
  assert.doesNotMatch(unsafe, /href=|data:image/);
  const grid = await render({ items: [{ name: "Example", href: "#moments", meta: ["Episode 1"] }] });
  assert.match(grid, /href="#moments"/); assert.match(grid, /Episode 1/);
});

test("page rendering keeps editorial background, feed CSS reserves ratios and all widths retain pairs", async () => {
  const html = await renderHtml(createElement(PageRenderer, { page: { title: "Fictional", slug: "fictional-feed", template: "PERSON", locale: "zh-TW", content: { renderVersion: 2, sections: [{ type: "project-cards", data }] } } }));
  assert.match(html, /background-color:#f6f5f0/);
  assert.doesNotMatch(html, /background-color:#f9fafb/);
  const styles = readFileSync(new URL("../src/templates/sections/editorial.module.css", import.meta.url), "utf8");
  assert.match(styles, /\.feed \{ max-width: 680px/);
  assert.match(styles, /\.feedMedia \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.feedDescription \{[^}]*white-space: pre-line/);
  assert.match(styles, /\.section a:focus-visible \{[^}]*outline: 2px solid var\(--accent\)/);
});

test("existing ItemList and OG use feed media and href, resolving anchors against the current page", () => {
  const page = { title: "Fictional", locale: "en", content: { sections: [{ type: "project-cards", data: { layout: "feed", items: [{ name: "Episode", description: "First line\nSecond", href: "?t=1:30#video", media }] } }] } };
  const graph = buildJsonLd(page, "https://appai.info/p/fictional-feed", "https://appai.info", null)["@graph"];
  const list = graph.find(entry => entry["@type"] === "ItemList");
  assert.equal(list.itemListElement[0].url, "https://appai.info/p/fictional-feed?t=1:30#video");
  assert.equal(list.itemListElement[0].image, media[0].url);
  assert.equal(list.itemListElement[0].description, "First line\nSecond");
  assert.equal(hostedOgImage(page), media[0].url);
});

test("llms lists feed titles, plain descriptions and href for the default locale", async () => {
  fixtureDb.rows = [{ id: "fictional-feed", slug: "fictional-feed", locale: "en", title: "Fictional archive", tagline: null, updatedAt: new Date("2026-01-01"), isDefault: true, isPublished: true, deletedAt: null, adminUnpublishedAt: null, parentSlug: null, content: { sections: [{ type: "project-cards", data }] } }];
  const text = await (await llms()).text();
  assert.match(text, /\/p\/fictional-feed\?t=90#video — The Paper Observatory: First line Second line/);
  assert.match(text, /Featured episode/);
});

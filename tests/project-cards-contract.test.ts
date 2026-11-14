import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editorialLink, projectCardUrl, PROJECT_CARD_HREF_PATTERN } from "../src/lib/hosted-editorial-links.ts";
import { projectCardsContentIssues } from "../src/lib/project-cards.ts";
import { createPageSchema, updatePageSchema } from "../src/lib/validations/page.ts";
import { checkPagePreview } from "../src/lib/page-preview.ts";
import { sanitizePageContent } from "../src/lib/sanitize.ts";
import { samePageVideoTime } from "../src/lib/video-navigation.ts";
import { usesEditorialScreenshots } from "../src/lib/screenshot-layout.ts";

const origin = "https://appai.info";
const media = { url: "https://example.com/frame.png", alt: "" };
const content = (data: unknown) => ({ sections: [{ type: "about", data: { text: "Fictional" } }, { type: "project-cards", data }] });
const issues = (data: unknown) => projectCardsContentIssues(content(data));
const item = (data: unknown) => issues({ items: [{ name: "Episode", ...data as object }] });

test("optional layout enum and fields retain grid default", () => {
  for (const data of [{}, { layout: "grid" }, { layout: "feed" }, { items: [{ name: "Episode" }] }]) assert.deepEqual(issues(data), []);
  for (const layout of ["list", "", false, 1, null]) assert.match(issues({ layout })[0].message, /sections\[1\]\.data\.layout/);
  assert.deepEqual(item({ media: [media], featured: true }), [], "new fields are accepted in default grid");
  assert.equal(usesEditorialScreenshots(content({ layout: "feed" }).sections), true);
});

test("href policy accepts hosted/HTTPS/anchor/time links and rejects unsafe or unrelated paths", () => {
  const allow = ["https://example.com/post", "https://example.com/?a=b#c", "/p/x", "/p/x?t=90#video", "/p/x/zh-TW/episode#video", "#moments", "?t=1:30#video", "?t=24:00:00#video"];
  const deny = ["https://:", "https://[", "https://example.com:abc", "https://example.com:65536", "javascript:alert(1)", "data:text/html,x", "http://example.com", "http://appai.info/p/x", "//evil", "/\\evil", "/p/x/../../api", "/p/x/%2e%2e/api", "/p/x?t=1:75#video", "/p/x?foo=1", "/other", "relative", "https://user:pass@example.com", "https://user@example.com", "https://example.com\\@evil.test", "https://example.com/\nfoo", "https://example.com/<script>", "#", "?t=90", "?t=86401#video", "?t=1:30#", ""];
  for (const href of allow) {
    assert.ok(editorialLink(href, origin, "project-card"), href);
    assert.ok(new RegExp(PROJECT_CARD_HREF_PATTERN).test(href), href);
    assert.deepEqual(item({ href, media: [{ ...media, href }] }), [], href);
  }
  for (const href of deny) {
    assert.equal(editorialLink(href, origin, "project-card"), undefined, href);
    assert.ok(item({ href }).length, href);
    assert.ok(item({ media: [{ ...media, href }] }).length, href);
  }
  assert.deepEqual(item({ href: `https://example.com/${"x".repeat(2028)}` }), []);
  assert.ok(item({ href: `https://example.com/${"x".repeat(2030)}` }).length);
  assert.equal(projectCardUrl("?t=1:30#video", `${origin}/p/x`), `${origin}/p/x?t=1:30#video`);
});

test("meta limits apply after trimming; media count, label, alt, aspect and featured types are bounded", () => {
  for (const meta of [[], ["  A  "], ["x".repeat(40), "B", "C"], [` ${"x".repeat(40)} `]]) assert.deepEqual(item({ meta }), []);
  for (const meta of [[""], ["   "], ["x".repeat(41)], ["A", "B", "C", "D"], [12], "A", null]) assert.ok(item({ meta }).length);
  for (const count of [0, 1, 2, 3]) assert.equal(item({ media: Array.from({ length: count }, () => media) }).length === 0, count === 1 || count === 2);
  for (const aspect of [undefined, "16:9", "1:1", "4:5"]) assert.deepEqual(item({ media: [{ ...media, aspect, label: "x".repeat(24) }] }), []);
  for (const tile of [{ ...media, label: "x".repeat(25) }, { ...media, aspect: "4:3" }, { url: media.url }, { ...media, alt: 12 }, { ...media, url: "http://example.com/a.png" }, { ...media, url: "https://user@example.com/a.png" }, { ...media, href: "javascript:foo" }]) assert.ok(item({ media: [tile] }).length);
  for (const featured of [true, false]) assert.deepEqual(item({ featured }), []);
  for (const featured of ["true", 1, null]) assert.ok(item({ featured }).length);
});

test("create/update/preview helpers report indexed paths and query links survive sanitization", () => {
  const bad = content({ items: Array.from({ length: 5 }, (_, i) => ({ name: "Fictional", ...(i === 4 ? { media: [media, media, { ...media, aspect: "bad" }] } : {}) })) });
  const page = { slug: "fictional-feed", title: "Fictional feed", content: bad };
  for (const parsed of [createPageSchema.safeParse(page), updatePageSchema.safeParse({ content: bad })]) {
    assert.equal(parsed.success, false);
    if (!parsed.success) assert.match(JSON.stringify(parsed.error.issues), /sections\[1\]\.data\.items\[4\]\.media\[2\]\.aspect/);
  }
  assert.match(JSON.stringify(checkPagePreview(page).errors), /sections\[1\]\.data\.items\[4\]\.media\[2\]\.aspect/);
  const href = "?t=1:30#video";
  const saved = sanitizePageContent(content({ layout: "feed", items: [{ name: "Episode", href, media: [{ ...media, href }] }] }));
  assert.equal(JSON.stringify(saved).split(href).length - 1, 2);
  assert.deepEqual(samePageVideoTime(href, `${origin}/p/x`)?.t, 90);
  assert.equal(samePageVideoTime("/p/x?t=90#video", `${origin}/p/x`)?.id, "video");
});

test("the fictional documented preview payload passes the same preview helper", () => {
  const spec = readFileSync(new URL("../docs/spec/sections.md", import.meta.url), "utf8");
  const example = spec.split("Fictional preview body")[1].match(/```json\n([\s\S]*?)\n```/)![1];
  const result = checkPagePreview(JSON.parse(example));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

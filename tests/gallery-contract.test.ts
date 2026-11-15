import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { galleryContentIssues, GALLERY_BADGE_PATTERN } from "../src/lib/gallery.ts";
import { editorialLink, PROJECT_CARD_HREF_PATTERN } from "../src/lib/hosted-editorial-links.ts";
import { createPageSchema, updatePageSchema } from "../src/lib/validations/page.ts";
import { checkPagePreview } from "../src/lib/page-preview.ts";
import { sanitizePageContent } from "../src/lib/sanitize.ts";

const image = { url: "https://example.com/frame.png" };
const content = (data: unknown) => ({ sections: [{ type: "about", data: {} }, { type: "gallery", data }] });
const issues = (data: unknown) => galleryContentIssues(content(data));
const itemIssues = (data: object) => issues({ items: [{ ...image, ...data }] });

test("gallery additive fields are optional; layout/aspect/columns reject other values and types", () => {
  for (const data of [{}, { items: [image, { ...image, type: "video" }] }, { layout: "masonry" }, { layout: "grid" }]) assert.deepEqual(issues(data), []);
  for (const aspect of ["16:9", "1:1", "4:3", "4:5"]) for (const columns of [2, 3, 4]) for (const layout of ["masonry", "grid"]) assert.deepEqual(issues({ layout, aspect, columns }), []);
  for (const [field, values] of Object.entries({ layout: ["feed", "", null, false, 1], aspect: ["3:2", "", null, 1], columns: [1, 5, 2.5, "3", false, null] })) {
    for (const value of values) assert.match(issues({ [field]: value })[0].message, new RegExp(`sections\\[1\\]\\.data\\.${field}`));
  }
});

test("gallery uses exactly the shared project-card href policy including scheme case, limits and native video exclusion", () => {
  const allow = ["https://example.com", "HTTPS://x.test/Case?Q=A#ID", "hTtPs://example.com/x", "https://example.com/?a=b#c", "/p/workshop", "/p/workshop?t=90#video", "/p/workshop/zh-TW/recap#video", "#moments", "?t=104#video", "?t=1:44#video", "?t=24:00:00#video", `https://x.test/${"x".repeat(2033)}`];
  const deny = ["https://:", "https://[", "https://x.test:abc", "https://x.test:65536", "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "DATA:text/html,x", "http://x.test", "HtTp://x.test", "HTTP://appai.info/p/x", "//x.test", "/\\x.test", "/p/x/../../api", "/p/x/%2e%2e/api", "/other", "relative", "/P/workshop", "/p/x?T=90#video", "/p/x?foo=1", "/p/x?t=1:75#video", "?t=86401#video", "?t=90", "?t=1:30#", "#", "", "https://user:pass@x.test", "HTTPS://user@x.test", "https://x.test\\@evil.test", "https://x.test/\nfoo", "https://x.test/<script>", `https://x.test/${"x".repeat(2034)}`];
  for (const href of allow) {
    assert.ok(editorialLink(href, "https://appai.info", "project-card"), href);
    assert.ok(new RegExp(PROJECT_CARD_HREF_PATTERN).test(href), href);
    assert.deepEqual(itemIssues({ href }), [], href);
    assert.deepEqual(itemIssues({ href, type: "image" }), [], href);
    assert.match(itemIssues({ href, type: "video" })[0].message, /items\[0\]\.href.*native controls/);
  }
  for (const href of deny) {
    assert.equal(editorialLink(href, "https://appai.info", "project-card"), undefined, href);
    assert.ok(itemIssues({ href }).length, href);
  }
  for (const href of [null, 42, {}, []]) assert.ok(itemIssues({ href }).length);
});

test("badge lengths apply after trim and alt is optional, bounded and allowed to be explicitly empty", () => {
  const pattern = new RegExp(GALLERY_BADGE_PATTERN);
  for (const badge of ["1", "1:44", "Day 2", "x".repeat(12), ` \t${"x".repeat(12)}\n`, "a\nb"]) {
    assert.deepEqual(itemIssues({ badge }), []); assert.ok(pattern.test(badge));
  }
  for (const badge of ["", " \n\t", "x".repeat(13), ` ${"x".repeat(13)} `]) {
    assert.ok(itemIssues({ badge }).length); assert.equal(pattern.test(badge), false);
  }
  for (const badge of [1, null, false]) assert.ok(itemIssues({ badge }).length);
  for (const alt of ["", "The group sketching a paper bridge", "x".repeat(200)]) assert.deepEqual(itemIssues({ alt }), []);
  for (const alt of ["x".repeat(201), null, 1]) assert.ok(itemIssues({ alt }).length);
});

test("indexed errors survive create/update/preview and sanitize stores trimmed badges and only lowercases href schemes", () => {
  const bad = { sections: Array.from({ length: 4 }, (_, i) => ({ type: i === 3 ? "gallery" : "about", data: { items: Array.from({ length: 6 }, (_, j) => ({ ...image, badge: j === 5 ? "x".repeat(13) : "New" })) } })) };
  const page = { slug: "fictional-workshop", title: "Workshop recap", content: bad };
  for (const parsed of [createPageSchema.safeParse(page), updatePageSchema.safeParse({ content: bad })]) {
    assert.equal(parsed.success, false);
    if (!parsed.success) assert.match(JSON.stringify(parsed.error.issues), /sections\[3\]\.data\.items\[5\]\.badge/);
  }
  assert.match(JSON.stringify(checkPagePreview(page).errors), /sections\[3\]\.data\.items\[5\]\.badge/);
  const clean = content({ layout: "grid", items: [{ ...image, href: "HTTPS://Example.com/Case?Q=A#ID", badge: "  1:44  ", alt: "A paper bridge" }, { ...image, href: "?t=104#video" }] });
  const saved = sanitizePageContent(clean) as ReturnType<typeof content>;
  assert.deepEqual(saved.sections[1].data, { layout: "grid", items: [{ ...image, href: "https://Example.com/Case?Q=A#ID", badge: "1:44", alt: "A paper bridge" }, { ...image, href: "?t=104#video" }] });
});

test("fictional workshop preview in the spec uses a real video anchor and passes shared validation", () => {
  const spec = readFileSync(new URL("../docs/spec/sections.md", import.meta.url), "utf8");
  const example = spec.split("Fictional workshop preview body")[1].match(/```json\n([\s\S]*?)\n```/)![1];
  const body = JSON.parse(example);
  assert.equal(body.content.sections[0].data.id, "video");
  assert.equal(checkPagePreview(body).valid, true);
});

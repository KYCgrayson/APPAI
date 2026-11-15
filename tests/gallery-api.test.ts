import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { gameApiFixture, registerGameApiFixtures } from "./helpers/game-api-fixtures.mjs";
import { PROJECT_CARD_HREF_PATTERN } from "../src/lib/hosted-editorial-links.ts";
const loader = registerHostedRenderLoader();
const fixtures = registerGameApiFixtures();
test.after(() => { fixtures.deregister(); loader.deregister(); });
const collection = await import("../src/app/api/v1/pages/route.ts");
const pageRoute = await import("../src/app/api/v1/pages/[slug]/route.ts");
const section = await import("../src/app/api/v1/pages/[slug]/sections/[order]/route.ts");
const preview = await import("../src/app/api/v1/pages/preview/route.ts");
const definitions = await import("../src/app/api/v1/sections/route.ts");
const params = { params: Promise.resolve({ slug: "fictional-workshop" }) };
const sectionParams = { params: Promise.resolve({ slug: "fictional-workshop", order: "8" }) };
const request = (body: unknown, method = "POST", query = "") => new NextRequest(`https://appai.info/api/v1/pages${query}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const tile = { url: "https://example.com/frame.png", href: "?t=104#video", badge: "1:44", alt: "A paper bridge", caption: "The first prototype" };
const data = { layout: "grid", aspect: "4:3", columns: 4, items: [tile, { ...tile, href: "HTTPS://Example.com/Case?Q=A#ID", badge: "  Day 2  " }] };
const normalized = { ...data, items: [tile, { ...data.items[1], href: "https://Example.com/Case?Q=A#ID", badge: "Day 2" }] };
const content = (value: unknown) => ({ sections: [{ type: "about", order: 0, data: { text: "Fictional" } }, { type: "gallery", order: 8, data: value }] });
const page = { slug: "fictional-workshop", title: "Workshop recap", content: content(data) };
const calls = (value: unknown) => [
  () => collection.POST(request({ ...page, content: content(value) })),
  () => collection.POST(request({ ...page, content: content(value) }, "POST", "?upsert=true")),
  () => pageRoute.PUT(request({ content: content(value) }, "PUT"), params),
  () => pageRoute.PATCH(request({ content: content(value) }, "PATCH"), params),
  () => section.PATCH(request({ data: value }, "PATCH"), sectionParams),
  () => preview.POST(request({ ...page, content: content(value) })),
  () => collection.POST(request({ ...page, content: content(value) }, "POST", "?dryRun=true")),
];

test("all real write paths, preview and dryRun share gallery validation, normalization and indexed errors", async () => {
  gameApiFixture.page = null; gameApiFixture.apps = [];
  for (const call of calls(data)) {
    const response = await call(); const body = await response.json();
    assert.ok([200, 201].includes(response.status), JSON.stringify(body)); assert.notEqual(body.valid, false);
    const saved = body.content ?? body.sanitizedContent ?? { sections: [body.section] };
    assert.deepEqual(saved.sections.find((s: { type: string }) => s.type === "gallery").data, normalized);
  }
  const before = gameApiFixture.writes;
  const badValues = [
    [{ ...data, layout: "feed" }, "layout"], [{ ...data, aspect: "3:2" }, "aspect"],
    ...[1, 5, 2.5, "3"].map(columns => [{ ...data, columns }, "columns"]),
    ...["http://example.com", "HtTp://example.com", "JaVaScRiPt:alert(1)", "DATA:text/html,x", "HTTPS://user@example.com"].map(href => [{ ...data, items: [{ ...tile, href }] }, "items[0].href"]),
    [{ ...data, items: [{ ...tile, type: "video" }] }, "items[0].href"],
    ...[" ", "x".repeat(13), "<b></b>"].map(badge => [{ ...data, items: [{ ...tile, badge }] }, "items[0].badge"]),
    [{ ...data, items: [{ ...tile, alt: "x".repeat(201) }] }, "items[0].alt"],
    [{ ...data, items: Array.from({ length: 6 }, (_, i) => ({ ...tile, badge: i === 5 ? "x".repeat(13) : "New" })) }, "items[5].badge"],
  ] as const;
  for (const [value, path] of badValues) for (const [index, call] of calls(value).entries()) {
    const existing: Record<string, unknown> | null = gameApiFixture.page;
    if (index === 0) gameApiFixture.page = null; // exercise creation, including post-sanitize errors, before duplicate-slug checks
    const response = await call(); const body = await response.json();
    gameApiFixture.page = existing;
    assert.ok(response.status === 400 || body.valid === false, JSON.stringify(body));
    assert.ok(JSON.stringify(body).includes(`sections[1].data.${path}`), JSON.stringify(body));
  }
  assert.equal(gameApiFixture.writes, before);
  for (const call of [
    () => pageRoute.PATCH(request({ content: { sections: [{ type: "gallery", order: 8, data: { heading: "New heading" } }] } }, "PATCH"), params),
    () => section.PATCH(request({ data: { heading: "New heading" } }, "PATCH"), sectionParams),
  ]) {
    const response = await call(); const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    const saved = body.section ?? body.content.sections.find((s: { type: string }) => s.type === "gallery");
    assert.deepEqual(saved.data, { ...normalized, heading: "New heading" });
  }
});

test("POST rejects badge emptied by sanitization before any write even on a new page", async () => {
  gameApiFixture.page = null; gameApiFixture.apps = [];
  const before = gameApiFixture.writes;
  const response = await calls({ items: [{ ...tile, badge: "<b></b>" }] })[0]();
  assert.equal(response.status, 400);
  assert.match(JSON.stringify(await response.json()), /sections\[1\]\.data\.items\[0\]\.badge/);
  assert.equal(gameApiFixture.writes, before);
});

test("JSON Schema and registry expose bounded grid fields and forbid native video links", async () => {
  const response = await definitions.GET(new NextRequest("https://appai.info/api/v1/sections?format=jsonschema&type=gallery"));
  const schema = (await response.json()).sections.gallery;
  assert.deepEqual(schema.required, ["items"]);
  assert.deepEqual(schema.properties.layout.enum, ["masonry", "grid"]);
  assert.deepEqual(schema.properties.aspect.enum, ["16:9", "1:1", "4:3", "4:5"]);
  assert.equal(schema.properties.columns.type, "integer"); assert.equal(schema.properties.columns.minimum, 2); assert.equal(schema.properties.columns.maximum, 4);
  const item = schema.properties.items.items;
  assert.deepEqual(item.required, ["url"]);
  assert.deepEqual(item.not, { properties: { type: { const: "video" } }, required: ["type", "href"] });
  assert.equal(item.properties.href.pattern, PROJECT_CARD_HREF_PATTERN); assert.equal(item.properties.href.maxLength, 2048);
  assert.equal(new RegExp(item.properties.href.pattern).test("HTTPS://x.test"), true);
  assert.equal(new RegExp(item.properties.href.pattern).test("HTTP://x.test"), false);
  const badge = new RegExp(item.properties.badge.pattern);
  assert.ok(badge.test(` ${"x".repeat(12)} `));
  for (const value of [" ", "x".repeat(13)]) assert.equal(badge.test(value), false);
  assert.equal(item.properties.alt.maxLength, 200);
  const registry = await definitions.GET(new NextRequest("https://appai.info/api/v1/sections?type=gallery"));
  const fields = (await registry.json()).sections[0].fields;
  assert.deepEqual(fields.find((f: { name: string }) => f.name === "items").itemNot, item.not);
});

import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { gameApiFixture, registerGameApiFixtures } from "./helpers/game-api-fixtures.mjs";
const loader = registerHostedRenderLoader();
const fixtures = registerGameApiFixtures();
test.after(() => { fixtures.deregister(); loader.deregister(); });
const collection = await import("../src/app/api/v1/pages/route.ts");
const pageRoute = await import("../src/app/api/v1/pages/[slug]/route.ts");
const section = await import("../src/app/api/v1/pages/[slug]/sections/[order]/route.ts");
const preview = await import("../src/app/api/v1/pages/preview/route.ts");
const definitions = await import("../src/app/api/v1/sections/route.ts");
const params = { params: Promise.resolve({ slug: "fictional-feed" }) };
const sectionParams = { params: Promise.resolve({ slug: "fictional-feed", order: "8" }) };
const request = (body: unknown, method = "POST", query = "") => new NextRequest(`https://appai.info/api/v1/pages${query}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const data = { layout: "feed", sort: "date-desc", pagination: { defaultSize: 10 }, items: [{
  name: "Episode", date: "2026-11-22", publishedAt: "2026-11-22T00:00:00Z", href: "?t=1:30#video", meta: ["Episode 1"],
  media: [{ url: "https://example.com/frame.png", alt: "", href: "?t=90#video", label: "6 key moments" }],
}] };
const content = (value: unknown) => ({ sections: [{ type: "about", order: 0, data: { text: "Fictional" } }, { type: "project-cards", order: 8, data: value }] });
const page = { slug: "fictional-feed", title: "Fictional feed", content: content(data) };
const calls = (value: unknown) => [
  () => collection.POST(request({ ...page, content: content(value) })),
  () => collection.POST(request({ ...page, content: content(value) }, "POST", "?upsert=true")),
  () => pageRoute.PUT(request({ content: content(value) }, "PUT"), params),
  () => pageRoute.PATCH(request({ content: content(value) }, "PATCH"), params),
  () => section.PATCH(request({ data: value }, "PATCH"), sectionParams),
  () => preview.POST(request({ ...page, content: content(value) })),
  () => collection.POST(request({ ...page, content: content(value) }, "POST", "?dryRun=true")),
];

test("all real write routes and preview share card validation, indexed paths, and preserve seek URLs", async () => {
  gameApiFixture.page = null; gameApiFixture.apps = [];
  for (const call of calls(data)) {
    const response = await call();
    const body = await response.json();
    assert.ok([200, 201].includes(response.status), JSON.stringify(body));
    assert.notEqual(body.valid, false);
    const saved = body.content ?? body.sanitizedContent ?? { sections: [body.section] };
    assert.deepEqual(saved.sections.find((s: { type: string }) => s.type === "project-cards").data, data);
  }
  const before = gameApiFixture.writes;
  const badValues = [
    [{ ...data, layout: "wrong" }, "layout"],
    [{ ...data, items: [{ ...data.items[0], date: "2026-11-31" }] }, "items[0].date"],
    [{ ...data, items: [{ name: "Episode", href: "http://example.com" }] }, "items[0].href"],
    [{ ...data, items: [{ name: "Episode", meta: [" "] }] }, "items[0].meta[0]"],
    [{ ...data, items: [{ name: "Episode", media: [] }] }, "items[0].media"],
    [{ ...data, items: [{ name: "Episode", featured: "true" }] }, "items[0].featured"],
    [{ ...data, items: Array.from({ length: 5 }, (_, i) => ({ name: "Episode", ...(i === 4 ? { media: [data.items[0].media[0], data.items[0].media[0], { ...data.items[0].media[0], aspect: "bad" }] } : {}) })) }, "items[4].media[2].aspect"],
  ] as const;
  for (const [value, path] of badValues) for (const call of calls(value)) {
    const response = await call(); const body = await response.json();
    assert.ok(response.status === 400 || body.valid === false, JSON.stringify(body));
    assert.ok(JSON.stringify(body).includes(`sections[1].data.${path}`), JSON.stringify(body));
  }
  assert.equal(gameApiFixture.writes, before);
  const patch = await section.PATCH(request({ data: { heading: "New heading" } }, "PATCH"), sectionParams);
  assert.equal((await patch.json()).section.data.layout, "feed");
});

test("JSON Schema exposes layout, scalar meta constraints and nested media contract", async () => {
  const response = await definitions.GET(new NextRequest("https://appai.info/api/v1/sections?format=jsonschema&type=project-cards"));
  const schema = (await response.json()).sections["project-cards"];
  assert.deepEqual(schema.properties.layout.enum, ["grid", "feed"]);
  assert.deepEqual(schema.properties.sort.enum, ["date-desc"]);
  assert.deepEqual(schema.properties.pagination.required, ["defaultSize"]);
  assert.equal(schema.properties.pagination.additionalProperties, false);
  assert.deepEqual(schema.properties.pagination.properties.defaultSize.enum, [10, 20]);
  const fields = schema.properties.items.items.properties;
  assert.equal(fields.date.format, "date");
  assert.equal(fields.publishedAt.format, "date-time");
  assert.equal(new RegExp(fields.date.pattern).test("2026-02-30"), false);
  assert.equal(new RegExp(fields.publishedAt.pattern).test("2026-11-22T00:00Z"), false);
  assert.equal(new RegExp(fields.publishedAt.pattern).test("2026-11-22T08:00:00.123+08:00"), true);
  assert.equal(fields.href.maxLength, 2048);
  for (const bad of ["https://:", "https://[", "https://example.com:abc", "https://example.com:65536"]) {
    assert.equal(new RegExp(fields.href.pattern).test(bad), false);
    assert.equal(new RegExp(fields.media.items.properties.url.pattern).test(bad), false);
  }
  assert.equal(fields.meta.maxItems, 3);
  assert.equal(fields.meta.items.type, "string");
  const metaPattern = new RegExp(fields.meta.items.pattern);
  assert.equal(metaPattern.test(` ${"x".repeat(40)} `), true);
  for (const value of [" ", "x".repeat(41)]) assert.equal(metaPattern.test(value), false);
  assert.equal(fields.media.minItems, 1); assert.equal(fields.media.maxItems, 2);
  assert.deepEqual(fields.media.items.required, ["url", "alt"]);
  assert.equal(fields.media.items.properties.label.maxLength, 24);
  assert.deepEqual(fields.media.items.properties.aspect.enum, ["16:9", "1:1", "4:5"]);
  assert.equal(fields.featured.type, "boolean");
  assert.deepEqual(schema.properties.items.items.required, ["name"]);
});

test("page and section PATCH reject pagination when an untouched section already uses it", async () => {
  gameApiFixture.page = null; gameApiFixture.apps = [];
  const weekly = { type: "project-cards", order: 10, data: { items: [{ name: "Weekly issue" }] } };
  const seed = await collection.POST(request({ ...page, content: { sections: [...page.content.sections, weekly] } }));
  assert.equal(seed.status, 201);
  const before = gameApiFixture.writes;
  const pagination = { defaultSize: 20 };
  for (const response of [
    await pageRoute.PATCH(request({ content: { sections: [{ order: 10, data: { pagination } }] } }, "PATCH"), params),
    await section.PATCH(request({ data: { pagination } }, "PATCH"), { params: Promise.resolve({ slug: "fictional-feed", order: "10" }) }),
  ]) {
    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /sections\[2\]\.data\.pagination: only one/);
  }
  assert.equal(gameApiFixture.writes, before);
});

test("every path also rejects metadata emptied by the plain-text sanitizer", async () => {
  const changed = { ...data, items: [{ name: "Episode", meta: ["<b></b>"] }] };
  gameApiFixture.page = null; gameApiFixture.apps = [];
  const first = await calls(changed)[0]();
  assert.equal(first.status, 400);
  assert.match(JSON.stringify(await first.json()), /sections\[1\]\.data\.items\[0\]\.meta\[0\]/);
  const seed = await collection.POST(request(page));
  assert.equal(seed.status, 201);
  const before = gameApiFixture.writes;
  for (const call of calls(changed).slice(1)) {
    const response = await call(); const body = await response.json();
    assert.ok(response.status === 400 || body.valid === false, JSON.stringify(body));
    assert.match(JSON.stringify(body), /sections\[1\]\.data\.items\[0\]\.meta\[0\]/);
  }
  assert.equal(gameApiFixture.writes, before);
});

test("all card write paths store lowercase HTTPS schemes in item and media hrefs", async () => {
  gameApiFixture.page = null; gameApiFixture.apps = [];
  const value = { ...data, items: [{ ...data.items[0], href: "HTTPS://Example.com/Case?Q=A#ID", media: [{ ...data.items[0].media[0], href: "hTtPs://Example.com/Media?Q=A#ID" }] }] };
  for (const call of calls(value)) {
    const response = await call(); const body = await response.json();
    assert.ok([200, 201].includes(response.status), JSON.stringify(body)); assert.notEqual(body.valid, false);
    const saved = body.content ?? body.sanitizedContent ?? { sections: [body.section] };
    const item = saved.sections.find((s: { type: string }) => s.type === "project-cards").data.items[0];
    assert.equal(item.href, "https://Example.com/Case?Q=A#ID");
    assert.equal(item.media[0].href, "https://Example.com/Media?Q=A#ID");
  }
});

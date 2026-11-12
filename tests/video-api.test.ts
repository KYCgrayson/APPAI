import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { gameApiFixture, registerGameApiFixtures } from "./helpers/game-api-fixtures.mjs";

const loader = registerHostedRenderLoader();
const fixtures = registerGameApiFixtures();
test.after(() => { fixtures.deregister(); loader.deregister(); });
const collection = await import("../src/app/api/v1/pages/route.ts");
const item = await import("../src/app/api/v1/pages/[slug]/route.ts");
const section = await import("../src/app/api/v1/pages/[slug]/sections/[order]/route.ts");
const preview = await import("../src/app/api/v1/pages/preview/route.ts");
const definitions = await import("../src/app/api/v1/sections/route.ts");
const params = { params: Promise.resolve({ slug: "fictional-video" }) };
const sectionParams = { params: Promise.resolve({ slug: "fictional-video", order: "8" }) };
const request = (body: unknown, method = "POST", query = "") => new NextRequest(`https://appai.info/api/v1/pages${query}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const data = { url: "https://youtu.be/Abc_123-xyz", moments: [{ t: "1:30", title: "Second" }, { t: 0, title: "Opening" }, { t: 90, title: "Duplicate" }] };
const page = { slug: "fictional-video", title: "Fictional video", content: { sections: [{ type: "about", order: 0, data: { text: "Example" } }, { type: "video", order: 8, data }] } };

test("create, upsert, PUT, page PATCH, section PATCH and preview normalize and reject before writing", async () => {
  gameApiFixture.page = null;
  gameApiFixture.apps = [];
  const check = async (response: Response) => {
    assert.ok([200, 201].includes(response.status));
    const body = await response.json();
    const saved = body.content ?? body.sanitizedContent ?? { sections: [body.section] };
    const video = saved.sections.find((s: { type: string }) => s.type === "video");
    assert.deepEqual(video.data.moments, [{ t: 0, title: "Opening" }, { t: 90, title: "Second" }]);
  };
  await check(await collection.POST(request(page)));
  await check(await collection.POST(request(page, "POST", "?upsert=true")));
  await check(await item.PUT(request({ content: page.content }, "PUT"), params));
  await check(await item.PATCH(request({ content: page.content }, "PATCH"), params));
  await check(await section.PATCH(request({ data }, "PATCH"), sectionParams));
  await check(await preview.POST(request(page)));
  const before = gameApiFixture.writes;
  const broken = { ...data, moments: [{ t: 0, title: "A" }, { t: 1, title: "B" }, { t: 2, title: "C" }, { t: "1:75", title: "Bad" }] };
  const content = { sections: [{ type: "about", order: 0, data: {} }, { type: "video", order: 8, data: broken }] };
  for (const response of [
    await collection.POST(request({ ...page, content })),
    await collection.POST(request({ ...page, content }, "POST", "?upsert=true")),
    await item.PUT(request({ content }, "PUT"), params),
    await item.PATCH(request({ content }, "PATCH"), params),
    await section.PATCH(request({ data: broken }, "PATCH"), sectionParams),
    await preview.POST(request({ ...page, content })),
  ]) {
    const body = await response.json();
    assert.ok(response.status === 400 || body.valid === false);
    assert.match(JSON.stringify(body), /sections\[1\]\.data\.moments\[3\]\.t/);
  }
  assert.equal(gameApiFixture.writes, before);
  const badUrl = await section.PATCH(request({ data: { url: "javascript:alert(1)" } }, "PATCH"), sectionParams);
  assert.equal(badUrl.status, 400);
  assert.match(JSON.stringify(await badUrl.json()), /Use a YouTube/);
  assert.equal(gameApiFixture.writes, before);
});

test("merged page and section PATCH validate final data, preserving and normalizing optional fields", async () => {
  await collection.POST(request(page, "POST", "?upsert=true"));
  const response = await item.PATCH(request({ content: { sections: [{ type: "video", order: 8, data: { startAt: "1:00" } }] } }, "PATCH"), params);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.content.sections[1].data.startAt, 60);
  assert.equal(body.content.sections[1].data.url, data.url);
  const updated = await section.PATCH(request({ data: { startAt: "0:30" } }, "PATCH"), sectionParams);
  assert.equal((await updated.json()).section.data.startAt, 30);
});

test("JSON Schema endpoint exposes optional bounded fields and time alternatives", async () => {
  const response = await definitions.GET(new NextRequest("https://appai.info/api/v1/sections?format=jsonschema&type=video"));
  const schema = (await response.json()).sections.video;
  assert.deepEqual(schema.required, ["url"]);
  assert.equal(schema.properties.moments.maxItems, 100);
  assert.deepEqual(schema.properties.moments.items.required, ["t", "title"]);
  assert.equal(schema.properties.moments.items.properties.title.maxLength, 120);
  assert.equal(schema.properties.moments.items.properties.text.maxLength, 600);
  assert.equal(schema.properties.momentsHeading.maxLength, 60);
  for (const field of [schema.properties.startAt, schema.properties.moments.items.properties.t]) {
    assert.deepEqual(field.anyOf[0], { type: "integer", minimum: 0, maximum: 86400 });
    const pattern = new RegExp(field.anyOf[1].pattern);
    assert.equal(pattern.test("1:30"), true);
    for (const bad of ["1:75", "24:00:01", "86401"]) assert.equal(pattern.test(bad), false);
  }
});

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

test("new pages reject unrecognized URLs, including when upsert or preview is requested", async () => {
  gameApiFixture.page = null; gameApiFixture.apps = [];
  const before = gameApiFixture.writes;
  for (const url of ["https://fictional-tool.vercel.app/?ref=youtube.com", "https://vimeo.com/showcase/123", "http://example.test/a.mp4", "https://example.test/stream.m3u8"]) {
    const body = { ...page, content: { sections: [{ type: "video", order: 8, data: { url } }] } };
    for (const response of [await collection.POST(request(body)), await collection.POST(request(body, "POST", "?upsert=true")), await preview.POST(request(body)), await collection.POST(request(body, "POST", "?dryRun=true"))]) {
      const result = await response.json();
      assert.ok(response.status === 400 || result.valid === false, JSON.stringify(result));
      assert.match(JSON.stringify(result), /sections\[0\]\.data\.url/);
      assert.match(JSON.stringify(result), /Use a YouTube/);
    }
  }
  assert.equal(gameApiFixture.writes, before);
});

test("changing a video to an unrecognized URL fails on upsert, PUT, page/section PATCH and preview", async () => {
  await collection.POST(request(page, "POST", "?upsert=true"));
  const before = gameApiFixture.writes;
  const changed = { ...data, url: "https://fictional-tool.vercel.app/?ref=youtube.com" };
  const content = { sections: [{ type: "video", order: 8, data: changed }] };
  for (const response of [
    await collection.POST(request({ ...page, content }, "POST", "?upsert=true")),
    await item.PUT(request({ content }, "PUT"), params),
    await item.PATCH(request({ content }, "PATCH"), params),
    await section.PATCH(request({ data: changed }, "PATCH"), sectionParams),
    await preview.POST(request({ ...page, content })),
    await collection.POST(request({ ...page, content }, "POST", "?dryRun=true&upsert=true")),
  ]) {
    const body = await response.json();
    assert.ok(response.status === 400 || body.valid === false, JSON.stringify(body));
    assert.match(JSON.stringify(body), /sections\[\d\]\.data\.url/);
    assert.match(JSON.stringify(body), /Use a YouTube/);
  }
  assert.equal(gameApiFixture.writes, before);
  assert.equal(((gameApiFixture.page!.content as typeof page.content).sections[1].data as typeof data).url, data.url);
});

test("every update/preview path grandfathers the same stored legacy URL and returns field warnings", async () => {
  const legacyData = { url: "https://vimeo.com/showcase/123", uploadDate: "bad", duration: "bad", moments: [{ t: 0, title: "Opening" }, { t: 0, title: "Duplicate" }] };
  const legacyPage = { ...page, content: { sections: [{ type: "about", order: 0, data: {} }, { type: "video", order: 8, data: legacyData }] } };
  await collection.POST(request(page, "POST", "?upsert=true"));
  gameApiFixture.page!.content = legacyPage.content;
  const create = await collection.POST(request(legacyPage));
  assert.equal(create.status, 400, "create never grandfathers even when the slug already exists");
  for (const response of [
    await collection.POST(request(legacyPage, "POST", "?upsert=true")),
    await item.PUT(request({ content: legacyPage.content }, "PUT"), params),
    await item.PATCH(request({ content: legacyPage.content }, "PATCH"), params),
    await section.PATCH(request({ data: legacyData }, "PATCH"), sectionParams),
    await preview.POST(request(legacyPage)),
    await collection.POST(request(legacyPage, "POST", "?dryRun=true")),
  ]) {
    const body = await response.json();
    assert.ok([200, 201].includes(response.status), JSON.stringify(body));
    assert.notEqual(body.valid, false);
    for (const field of ["url", "uploadDate", "duration", "moments[1]"]) {
      assert.ok(body.warnings.some((w: { path: string; message: string }) => w.path.endsWith(`data.${field}`) && typeof w.message === "string"), JSON.stringify(body.warnings));
    }
    assert.match(JSON.stringify(body.warnings), /moments need a YouTube, Vimeo or https .mp4\/.webm URL/);
    assert.match(JSON.stringify(body.warnings), /grandfathered/);
  }
});

test("PATCH can resend an unknown stored web URL but cannot replace it with another unknown URL", async () => {
  await collection.POST(request(page, "POST", "?upsert=true"));
  const url = "https://fictional-tool.vercel.app/?ref=youtube.com";
  gameApiFixture.page!.content = { sections: [{ type: "video", order: 8, data: { url } }] };
  for (const response of [
    await item.PATCH(request({ content: { sections: [{ type: "video", order: 8, data: { url } }] } }, "PATCH"), params),
    await item.PATCH(request({ content: { sections: [{ type: "video", data: { url } }] } }, "PATCH"), params),
    await section.PATCH(request({ data: { url } }, "PATCH"), sectionParams),
  ]) {
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.warnings.some((w: { path: string; message: string }) => w.path.endsWith("data.url") && /grandfathered/.test(w.message)));
  }
  const before = gameApiFixture.writes;
  const changed = await section.PATCH(request({ data: { url: `${url}&changed=true` } }, "PATCH"), sectionParams);
  assert.equal(changed.status, 400);
  assert.equal(gameApiFixture.writes, before);
});

test("grandfathering follows section IDs on full replacement and cannot copy a legacy URL into a new section", async () => {
  await collection.POST(request(page, "POST", "?upsert=true"));
  const url = "https://example.test/legacy-player";
  gameApiFixture.page!.content = { sections: [{ id: "stored-video", order: 8, type: "video", data: { url } }] };
  const content = { sections: [{ id: "stored-video", order: 12, type: "video", data: { url } }] };
  const reordered = await item.PUT(request({ content }, "PUT"), params);
  assert.equal(reordered.status, 200);
  assert.ok((await reordered.json()).warnings.some((w: { path: string }) => w.path.endsWith("data.url")));
  const copied = { sections: [...content.sections, { id: "new-video", order: 13, type: "video", data: { url } }] };
  const before = gameApiFixture.writes;
  for (const response of [
    await collection.POST(request({ ...page, content: copied }, "POST", "?upsert=true")),
    await item.PUT(request({ content: copied }, "PUT"), params),
    await item.PATCH(request({ content: copied }, "PATCH"), params),
    await preview.POST(request({ ...page, content: copied })),
  ]) {
    const body = await response.json();
    assert.ok(response.status === 400 || body.valid === false, JSON.stringify(body));
    assert.match(JSON.stringify(body), /sections\[1\]\.data\.url/);
  }
  assert.equal(gameApiFixture.writes, before);
});

test("title-only and unrelated-section PATCH preserve untouched legacy videos and do not validate their old fields", async () => {
  await collection.POST(request(page, "POST", "?upsert=true"));
  const legacy = { type: "video", order: 8, data: { url: "http://example.test/film.mp4", uploadDate: "old malformed date", duration: "bad", moments: [{ t: "old invalid time", title: "Old scene" }] } };
  gameApiFixture.page!.content = { sections: [{ type: "about", order: 0, data: { text: "Before" } }, legacy] };
  const before = JSON.stringify(legacy);
  for (const response of [
    await item.PATCH(request({ title: "Updated title" }, "PATCH"), params),
    await item.PATCH(request({ content: { sections: [{ type: "about", order: 0, data: { text: "After" } }] } }, "PATCH"), params),
    await section.PATCH(request({ data: { text: "Again" } }, "PATCH"), { params: Promise.resolve({ slug: "fictional-video", order: "0" }) }),
  ]) {
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    const body = await response.json();
    assert.ok(body.warnings.some((w: { path: string }) => w.path.endsWith("data.url")));
  }
  assert.equal(JSON.stringify((gameApiFixture.page!.content as typeof page.content).sections[1]), before);
  const touched = await section.PATCH(request({ data: { caption: "Edited video" } }, "PATCH"), sectionParams);
  assert.equal(touched.status, 400);
  assert.match(JSON.stringify(await touched.json()), /moments\[0\]\.t/);
});

test("unsafe URLs and moment limits remain hard errors on each write path", async () => {
  await collection.POST(request(page, "POST", "?upsert=true"));
  const before = gameApiFixture.writes;
  for (const url of ["javascript:alert(1)", "data:video/mp4,example", "ftp://example.test/a.mp4", "https://youtube.com.evil.test/a.mp4", "https://player.vimeo.com.evil.test/123", 'https://example.test/<script>alert(1)</script>']) {
    const content = { sections: [{ type: "video", order: 8, data: { url } }] };
    for (const response of [
      await collection.POST(request({ ...page, content }, "POST", "?upsert=true")),
      await item.PUT(request({ content }, "PUT"), params),
      await item.PATCH(request({ content }, "PATCH"), params),
      await section.PATCH(request({ data: { url } }, "PATCH"), sectionParams),
    ]) assert.equal(response.status, 400, url);
  }
  const overLimit = await section.PATCH(request({ data: { moments: Array.from({ length: 101 }, (_, t) => ({ t, title: "Scene" })) } }, "PATCH"), sectionParams);
  assert.equal(overLimit.status, 400);
  assert.equal(gameApiFixture.writes, before);
});

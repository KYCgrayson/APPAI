import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server.js";
import { registerHostedRenderLoader, registerDirectoryFixtures } from "./helpers/hosted-render-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { gameApiFixture, currentGamePage, registerGameApiFixtures } from "./helpers/game-api-fixtures.mjs";

const hooks = registerHostedRenderLoader();
const apiHooks = registerGameApiFixtures();
const intl = registerDirectoryFixtures({ translated: true });
test.after(() => { intl.deregister(); apiHooks.deregister(); hooks.deregister(); });
const collection = await import("../src/app/api/v1/pages/route.ts");
const item = await import("../src/app/api/v1/pages/[slug]/route.ts");
const sectionApi = await import("../src/app/api/v1/pages/[slug]/sections/[order]/route.ts");
const sessionApi = await import("../src/app/api/v1/tools/sessions/issue/route.ts");
const publish = await import("../src/app/api/v1/pages/[slug]/publish/route.ts");
const setDefault = await import("../src/app/api/v1/pages/[slug]/set-default/route.ts");
const { default: HomePage } = await import("../src/app/[locale]/page.tsx");
const example = JSON.parse(readFileSync(new URL("../docs/examples/game.example.json", import.meta.url), "utf8"));
const request = (body: unknown, method = "POST", query = "") => new NextRequest(`https://appai.info/api/v1/pages${query}`, { method, headers: { "content-type": "application/json", authorization: "Bearer fixture" }, body: JSON.stringify(body) });
const params = { params: Promise.resolve({ slug: example.slug }) };

test("game publishing APIs persist and return pending applications across create, read, upsert and edits", async () => {
  gameApiFixture.page = null;
  gameApiFixture.writes = 0;
  const created = await collection.POST(request(example));
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.gamesListing, "requested");
  assert.equal(body.content.gamesListing, "requested");
  assert.equal((await (await item.GET(new NextRequest("https://appai.info/api/v1/pages/x"), params)).json()).gamesListing, "requested");
  assert.equal((await (await collection.GET(new NextRequest("https://appai.info/api/v1/pages"))).json())[0].gamesListing, "requested");
  assert.equal((await (await collection.POST(request(example, "POST", "?upsert=true"))).json()).gamesListing, "requested");
  assert.equal((await item.PATCH(request({ content: { sections: [{ type: "game", order: 0, data: { description: "Edited description" } }] } }, "PATCH"), params)).status, 200);
  assert.equal((await (await item.PUT(request({ title: "Edited title" }, "PUT"), params)).json()).gamesListing, "requested");
  const withdrawn = await sectionApi.PATCH(request({ data: { listInGames: false } }, "PATCH"), { params: Promise.resolve({ slug: example.slug, order: "0" }) });
  assert.equal(withdrawn.status, 200);
  assert.equal((await withdrawn.json()).gamesListing, undefined);
  const updated = await item.PATCH(request({ content: { sections: [{ type: "game", order: 0, data: { listInGames: true } }] } }, "PATCH"), params);
  assert.equal((await updated.json()).gamesListing, "requested");
});

test("merged PATCH, PUT and single-section updates reject invalid game data before writing", async () => {
  await collection.POST(request(example, "POST", "?upsert=true"));
  const before = gameApiFixture.writes;
  const content = { sections: [{ type: "game", order: 0, data: { gameUrl: "https://example.com" } }] };
  assert.equal((await item.PATCH(request({ content }, "PATCH"), params)).status, 400);
  assert.equal((await item.PUT(request({ content }, "PUT"), params)).status, 400);
  assert.equal((await sectionApi.PATCH(request({ data: { gameUrl: "http://game.pages.dev" } }, "PATCH"), { params: Promise.resolve({ slug: example.slug, order: "0" }) })).status, 400);
  assert.equal(gameApiFixture.writes, before);
});

test("game sessions are rejected even with identity true", async () => {
  await collection.POST(request(example, "POST", "?upsert=true"));
  gameApiFixture.issued.length = 0;
  for (const identity of [false, true]) {
    await item.PATCH(request({ content: { sections: [{ type: "game", order: 0, data: { identity } }] } }, "PATCH"), params);
    assert.equal((await sessionApi.POST(request({ pageId: "fixture-page", section: 0 }))).status, 404);
  }
  assert.equal(gameApiFixture.issued.length, 0);
});

test("tool renewal uses normalized orders and fallback indices and keeps access gates", async () => {
  const tool = { type: "iframe-tool", data: { src: "https://tool.pages.dev", identity: true } };
  for (const sections of [
    [{ type: "about", order: 10, data: {} }, tool],
    [null, "broken", { ...tool, order: "0" }, { type: "about", data: null }],
  ]) {
    gameApiFixture.page = { id: "fixture-page", slug: "tool", isPublished: true, content: { sections } };
    gameApiFixture.issued.length = 0;
    assert.equal((await sessionApi.POST(request({ pageId: "fixture-page", section: 0 }))).status, 200);
    assert.equal(gameApiFixture.issued[0].src, tool.data.src);
    assert.equal(gameApiFixture.issued[0].section, 0);
  }
  const page = currentGamePage();
  assert.ok(page);
  for (const access of ["login", "admin"]) {
    page.content = { sections: [{ ...tool, data: { ...tool.data, access } }] };
    assert.equal((await sessionApi.POST(request({ pageId: "fixture-page", section: 0 }))).status, 403);
  }
  page.content = { sections: [{ ...tool, data: { ...tool.data, identity: false } }] };
  assert.equal((await sessionApi.POST(request({ pageId: "fixture-page", section: 0 }))).status, 404);
});

test("a published GAME App stays out of both homepage approved lists", async () => {
  gameApiFixture.page = null;
  gameApiFixture.apps = [];
  assert.equal((await collection.POST(request(example))).status, 201);
  assert.equal(currentGamePage()?.isPublished, true);
  assert.equal(gameApiFixture.apps[0].category, "GAMES");
  assert.equal(gameApiFixture.apps[0].isApproved, false);
  gameApiFixture.appQueries = [];
  const html = await renderHtml(await HomePage());
  assert.ok(gameApiFixture.appQueries.some(q => q.isApproved === true && q.isFeatured === true));
  assert.ok(gameApiFixture.appQueries.some(q => q.isApproved === true && !q.isFeatured));
  assert.ok(!html.includes(example.title));
  assert.ok(!html.includes(`/apps/${gameApiFixture.apps[0].id}`));
});

test("GAME approval stays false across upsert, PUT, PATCH, section, publish and default changes", async () => {
  for (const mutate of [
    () => collection.POST(request(example, "POST", "?upsert=true")),
    () => item.PUT(request({ title: "Edited game" }, "PUT"), params),
    () => item.PATCH(request({ title: "Edited game" }, "PATCH"), params),
    () => sectionApi.PATCH(request({ data: { description: "Edited game" } }, "PATCH"), { params: Promise.resolve({ slug: example.slug, order: "0" }) }),
    () => publish.POST(request({}), params),
    () => setDefault.POST(request({}, "POST", "?locale=en"), params),
  ]) {
    gameApiFixture.page = null;
    gameApiFixture.apps = [];
    await collection.POST(request(example));
    gameApiFixture.apps[0].isApproved = true;
    assert.equal((await mutate()).status, 200);
    assert.equal(gameApiFixture.apps[0].isApproved, false);
  }
});

test("GAME conversion and a new non-default GAME locale reset an existing App approval", async () => {
  for (const method of ["PUT", "PATCH", "upsert", "create-locale"] as const) {
    gameApiFixture.page = null;
    gameApiFixture.apps = [];
    await collection.POST(request({ ...example, template: "APP_LANDING" }));
    assert.equal(gameApiFixture.apps[0].isApproved, true);
    let response;
    if (method === "create-locale") {
      gameApiFixture.page = null;
      gameApiFixture.variantCount = 1;
      response = await collection.POST(request({ ...example, locale: "ja" }));
      gameApiFixture.variantCount = 0;
    } else if (method === "upsert") response = await collection.POST(request(example, "POST", "?upsert=true"));
    else response = await item[method](request({ template: "GAME" }, method), params);
    assert.equal(response.status, method === "create-locale" ? 201 : 200);
    assert.equal(gameApiFixture.apps[0].isApproved, false, method);
  }
});

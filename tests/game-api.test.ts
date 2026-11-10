import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server.js";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { gameApiFixture, registerGameApiFixtures } from "./helpers/game-api-fixtures.mjs";

const hooks = registerHostedRenderLoader();
const apiHooks = registerGameApiFixtures();
test.after(() => { apiHooks.deregister(); hooks.deregister(); });
const collection = await import("../src/app/api/v1/pages/route.ts");
const item = await import("../src/app/api/v1/pages/[slug]/route.ts");
const sectionApi = await import("../src/app/api/v1/pages/[slug]/sections/[order]/route.ts");
const sessionApi = await import("../src/app/api/v1/tools/sessions/issue/route.ts");
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

test("game session issuance uses gameUrl and requires explicit identity opt-in", async () => {
  await collection.POST(request(example, "POST", "?upsert=true"));
  const noIdentity = await sessionApi.POST(request({ pageId: "fixture-page", section: 0 }));
  assert.equal(noIdentity.status, 404);
  await item.PATCH(request({ content: { sections: [{ type: "game", order: 0, data: { identity: true } }] } }, "PATCH"), params);
  gameApiFixture.issued.length = 0;
  const issued = await sessionApi.POST(request({ pageId: "fixture-page", section: 0 }));
  assert.equal(issued.status, 200);
  assert.equal(gameApiFixture.issued[0].src, example.content.sections[0].data.gameUrl);
  assert.equal((await issued.json()).token, "fixture-session");
});

test("game identity renewal uses the same fallback section index as the sorted renderer", async () => {
  const body = { ...example, content: { ...example.content, sections: [
    { type: "about", order: 10, data: { text: "About this game" } },
    { type: "game", data: { ...example.content.sections[0].data, identity: true } },
  ] } };
  assert.equal((await collection.POST(request(body, "POST", "?upsert=true"))).status, 200);
  const issued = await sessionApi.POST(request({ pageId: "fixture-page", section: 0 }));
  assert.equal(issued.status, 200);
});

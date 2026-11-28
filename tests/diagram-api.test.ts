import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { registerHostedRenderLoader, registerHostedHeaders } from "./helpers/hosted-render-loader.mjs";
import { gameApiFixture, registerGameApiFixtures } from "./helpers/game-api-fixtures.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { diagramFixture, diagramContent, invalidDiagrams } from "./helpers/diagram-fixtures.ts";
import { normalizeDiagramData } from "../src/lib/diagram.ts";
import { registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";

const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerGameApiFixtures()];
test.after(() => hooks.reverse().forEach(hook => hook.deregister()));
const collection = await import("../src/app/api/v1/pages/route.ts");
const pageRoute = await import("../src/app/api/v1/pages/[slug]/route.ts");
const section = await import("../src/app/api/v1/pages/[slug]/sections/[order]/route.ts");
const preview = await import("../src/app/api/v1/pages/preview/route.ts");
const definitions = await import("../src/app/api/v1/sections/route.ts");
const { default: HostedPage } = await import("../src/app/(legacy)/p/[...segments]/page.tsx");
const params = { params: Promise.resolve({ slug: "paper-workshop" }) };
const sectionParams = { params: Promise.resolve({ slug: "paper-workshop", order: "8" }) };
const request = (body: unknown, method = "POST", query = "") => new NextRequest(`https://appai.info/api/v1/pages${query}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const page = { slug: "paper-workshop", title: "Paper workshop", isPublished: true, content: diagramContent(diagramFixture) };
const calls = (data: unknown) => [
  () => collection.POST(request({ ...page, content: diagramContent(data) })),
  () => collection.POST(request({ ...page, content: diagramContent(data) }, "POST", "?upsert=true")),
  () => pageRoute.PUT(request({ content: diagramContent(data) }, "PUT"), params),
  () => pageRoute.PATCH(request({ content: diagramContent(data) }, "PATCH"), params),
  () => section.PATCH(request({ data }, "PATCH"), sectionParams),
  () => preview.POST(request({ ...page, content: diagramContent(data) })),
  () => collection.POST(request({ ...page, content: diagramContent(data) }, "POST", "?dryRun=true")),
];

test("all write paths accept diagrams and the saved page renders all four kinds through the actual hosted route", async () => {
  gameApiFixture.page = null; gameApiFixture.apps = [];
  for (const [index, call] of calls(diagramFixture).entries()) {
    const response = await call(); const body = await response.json();
    assert.ok([200, 201].includes(response.status), JSON.stringify(body)); assert.notEqual(body.valid, false);
    const saved = body.content ?? body.sanitizedContent ?? { sections: [body.section] };
    assert.deepEqual(saved.sections.find((s: { type: string }) => s.type === "diagram").data, normalizeDiagramData(diagramFixture));
    if (index < 5) {
      const html = await renderHtml(await HostedPage({ params: Promise.resolve({ segments: [page.slug] }) }));
      for (const kind of ["compare", "steps", "layers", "cycle"]) assert.ok(html.includes(`data-kind="${kind}"`), html);
      assert.ok(html.includes(diagramFixture.subheading));
      assert.match(html, /Choose a bridge/); assert.match(html, /href="\?t=90#workshop-video"/);
      assert.doesNotMatch(html, /<video|<iframe|<canvas/);
    }
  }
});

test("every write, preview and dry-run rejects all item limits and unsafe links with paths and zero writes", async () => {
  const before = gameApiFixture.writes;
  for (const { name, data, path } of invalidDiagrams) {
    // Empty/omitted section data is a valid partial merge, so exercise those
    // malformed complete sections through replacement/creation, not PATCH.
    const complete = data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length > 0;
    for (const [index, call] of calls(data).entries()) {
      if (!complete && [3, 4].includes(index)) continue;
      const existing = gameApiFixture.page;
      if (index === 0) gameApiFixture.page = null;
      const response = await call(); const body = await response.json();
      gameApiFixture.page = existing;
      assert.ok(response.status === 400 || body.valid === false, `${name}/${index}: ${JSON.stringify(body)}`);
      assert.ok(JSON.stringify(body).includes(`sections[1].data${path ? "." + path : ""}`), `${name}/${index}: ${JSON.stringify(body)}`);
    }
  }
  assert.equal(gameApiFixture.writes, before);
});

test("merged patches retain diagrams; post-sanitization empty text is rejected on every path", async () => {
  for (const call of [
    () => pageRoute.PATCH(request({ content: { sections: [{ type: "diagram", order: 8, data: { heading: "Updated heading" } }] } }, "PATCH"), params),
    () => section.PATCH(request({ data: { heading: "Updated heading" } }, "PATCH"), sectionParams),
  ]) {
    const response = await call(); const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    const saved = body.section ?? body.content.sections[1];
    assert.equal(saved.data.heading, "Updated heading"); assert.equal(saved.data.items.length, 4);
  }
  const before = gameApiFixture.writes;
  for (const [index, call] of calls({ items: [{ ...diagramFixture.items[0], title: "<b></b>" }] }).entries()) {
    const existing = gameApiFixture.page; if (index === 0) gameApiFixture.page = null;
    const response = await call(); const body = await response.json(); gameApiFixture.page = existing;
    assert.ok(response.status === 400 || body.valid === false, JSON.stringify(body));
    assert.match(JSON.stringify(body), /sections\[1\]\.data\.items\[0\]\.title/);
  }
  assert.equal(gameApiFixture.writes, before);
});

test("sections endpoint exposes discriminated fields, array bounds, HTTPS sources and focus dependency", async () => {
  const response = await definitions.GET(new NextRequest("https://appai.info/api/v1/sections?format=jsonschema&type=diagram"));
  const schema = (await response.json()).sections.diagram;
  const assertEmbeddedSchema = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.notEqual(key, "$schema");
      if (key === "additionalProperties") assert.notDeepEqual(child, {});
      assertEmbeddedSchema(child);
    }
  };
  assertEmbeddedSchema(schema);
  assert.deepEqual(schema.required, ["items"]); assert.ok(schema.properties.id);
  assert.equal(schema.properties.items.minItems, 1); assert.equal(schema.properties.items.maxItems, 12);
  const variants = schema.properties.items.items.oneOf;
  assert.deepEqual(variants.map((v: { properties: { kind: { const: string } } }) => v.properties.kind.const), ["compare", "steps", "layers", "cycle"]);
  for (const variant of variants) {
    const p = variant.properties;
    assert.equal(p.title.maxLength, 80); assert.equal(p.takeaway.maxLength, 120);
    assert.equal(p.sources.minItems, 1); assert.equal(p.sources.maxItems, 6);
    assert.equal(p.link.properties.label.maxLength, 40); assert.equal(p.link.properties.url.maxLength, 2048);
    const sourcePattern = new RegExp(p.sources.items.properties.url.pattern);
    assert.ok(sourcePattern.test("HTTPS://example.com"));
    for (const url of ["http://example.com", "//example.com", "/p/paper", "#anchor", "?t=90#id"]) assert.equal(sourcePattern.test(url), false);
    assert.ok(new RegExp(p.link.properties.url.pattern).test("?t=90#id"));
  }
  assert.equal(variants[0].properties.columns.maxItems, 4);
  assert.equal(variants[0].properties.columns.items.properties.points.maxItems, 6);
  assert.equal(variants[1].properties.steps.maxItems, 8);
  assert.equal(variants[2].properties.layers.maxItems, 6);
  assert.equal(variants[2].allOf[5].then.properties.layers.minItems, 6);
  assert.equal(variants[3].properties.steps.minItems, 3); assert.equal(variants[3].properties.steps.maxItems, 6);
  const registry = await definitions.GET(new NextRequest("https://appai.info/api/v1/sections?type=diagram"));
  const body = await registry.json();
  assert.equal(body.total, 1); assert.ok(body.sections[0].dataSchema); assert.ok(body.icons.includes("leaf-outline"));
  assertEmbeddedSchema(body.sections[0].dataSchema);
});

test("section schemas outside diagram and project-cards retain every byte and key order from the branch base", async () => {
  const baseline = registerMainHostedBaseline("3ddf782");
  try {
    const before = await import(baseline.moduleUrl("src/app/api/v1/sections/route.ts"));
    const url = "https://appai.info/api/v1/sections?format=jsonschema";
    const previous = await (await before.GET(new NextRequest(url))).json();
    const current = await (await definitions.GET(new NextRequest(url))).json();
    delete current.sections.diagram;
    // #116 extends the card schema, covered by project-cards-api.test.ts.
    delete current.sections["project-cards"];
    delete previous.sections["project-cards"];
    // #146 adds the video-ask section, covered by video-ask.test.ts.
    delete current.sections["video-ask"];
    assert.equal(JSON.stringify(current), JSON.stringify(previous));
  } finally { baseline.deregister(); }
});

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHostedContent, contentString } from "../src/lib/hosted-content.ts";
import { buildJsonLd, hostedOgImage } from "../src/lib/hosted-page-seo.ts";

test("null, scalar or non-array content.sections becomes an empty list", () => {
  for (const content of [null, 42, [], { sections: {} }, { sections: "broken" }]) {
    assert.deepEqual(normalizeHostedContent(content).sections, []);
    assert.doesNotThrow(() => hostedOgImage({ content }));
    assert.doesNotThrow(() => buildJsonLd({ content, createdAt: "bad-date", updatedAt: "bad-date" }, "https://example.test", "https://example.test", null));
  }
});
test("drop non-object sections; normalize missing data/order; preserve valid data", () => {
  const data = { heading: "Example" };
  const valid = { type: "hero", data };
  const result = normalizeHostedContent({ logo: "example.svg", sections: [null, "hero", 1, [], {}, valid, { type: "faq", data: null }, { type: "links", data: "bad", order: {} }] });
  assert.equal(result.sections.length, 3);
  assert.equal(result.sections[0], valid);
  assert.equal(result.sections[0].data, data);
  assert.deepEqual(result.sections[1].data, {});
  assert.deepEqual(result.sections[2].data, {});
  assert.equal(result.sections[2].order, undefined);
  assert.equal(result.logo, "example.svg");
});
test("repair lists and numeric text without rejecting harmless field types", () => {
  const [section] = normalizeHostedContent({ sections: [{ type: "pricing", data: {
    heading: {}, items: [null, { price: 123, highlighted: "true", features: {} }],
  } }] }).sections;
  assert.deepEqual(section.data.items, [{ price: "123", highlighted: "true", features: [] }]);
  assert.deepEqual(section.data.heading, {});
  assert.equal(contentString({}), undefined);
});


test("rendering and session lookup share normalized sorted section numbers", async () => {
  const { orderedHostedSections } = await import("../src/lib/hosted-content.ts");
  const result = orderedHostedSections({ sections: [
    null, "broken", { type: "about", order: 10, data: null },
    { type: "iframe-tool", order: "2", data: { src: "https://tool.pages.dev" } },
    { type: "game", data: { howToPlay: [123] } },
    { type: "about", order: -1, data: {} },
  ] });
  assert.deepEqual(result.map(s => [s.type, s.order]), [["about", -1], ["game", 1], ["iframe-tool", 2], ["about", 10]]);
  assert.deepEqual(result[1].data.howToPlay, ["123"]);
  assert.deepEqual(result[3].data, {});
});

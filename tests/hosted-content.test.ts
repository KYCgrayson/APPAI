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

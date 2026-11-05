import assert from "node:assert/strict";
import test from "node:test";
import { createAppSchema, updateAppSchema } from "../src/lib/validations/app.ts";
import { createPageSchema, updatePageSchema } from "../src/lib/validations/page.ts";

test("App updates preserve omitted fields instead of applying creation defaults", () => {
  assert.deepEqual(updateAppSchema.parse({ tags: ["x"] }), { tags: ["x"] });
  assert.deepEqual(updateAppSchema.parse({}), {});
  assert.deepEqual(updateAppSchema.parse({ category: "OTHER", tags: [], screenshots: [] }), {
    category: "OTHER", tags: [], screenshots: [],
  });
  assert.equal(updateAppSchema.safeParse({ category: "invalid" }).success, false);
  const created = createAppSchema.parse({ name: "Example", tagline: "Example", description: "Example" });
  assert.equal(created.category, "OTHER");
  assert.deepEqual(created.tags, []);
  assert.deepEqual(created.screenshots, []);
});

test("Page updates preserve omitted fields instead of applying creation defaults", () => {
  assert.deepEqual(updatePageSchema.parse({ title: "Updated" }), { title: "Updated" });
  assert.deepEqual(updatePageSchema.parse({}), {});
  const explicit = { locale: "ja", template: "PERSON", content: {}, darkMode: false, isPublished: false };
  assert.deepEqual(updatePageSchema.parse(explicit), explicit);
  assert.equal(updatePageSchema.safeParse({ locale: "invalid" }).success, false);
  const created = createPageSchema.parse({ slug: "example", title: "Example" });
  assert.equal(created.locale, "en");
  assert.equal(created.template, "APP_LANDING");
  assert.deepEqual(created.content, {});
  assert.equal(created.darkMode, false);
  assert.equal(created.isPublished, false);
});

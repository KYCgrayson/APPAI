import assert from "node:assert/strict";
import test from "node:test";
import { publisherLabel } from "../src/lib/publisher-label.ts";

test("ADMIN ownership always uses the platform domain", () => {
  assert.equal(publisherLabel({ name: "Example Studio", users: [{ role: "USER" }, { role: "ADMIN" }] }), "appai.info");
});
test("non-platform publishers use the organization name", () => {
  assert.equal(publisherLabel({ name: "Example Studio", users: [{ role: "USER" }] }), "Example Studio");
  assert.equal(publisherLabel({ name: "Example Studio", users: [] }), "Example Studio");
});

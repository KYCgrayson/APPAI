import test from "node:test";
import assert from "node:assert/strict";
import { editorialLink } from "../src/lib/hosted-editorial-links.ts";

test("editorial relative links reject network-path and backslash redirects", () => {
  for (const href of ["//evil.com", "/\\evil.com"]) {
    assert.equal(editorialLink(href, "https://appai.info"), undefined);
  }
  assert.deepEqual(editorialLink("/p/project", "https://appai.info"), { href: "/p/project", external: false });
});

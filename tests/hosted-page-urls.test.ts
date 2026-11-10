import test from "node:test";
import assert from "node:assert/strict";
import { hostedPagePath, hostedPageUrl, hostedAlternates, hasExternalCanonical } from "../src/lib/hosted-page-urls.ts";

const root = { slug: "site", organizationId: "fixture", locale: "en", isDefault: true };
const roots = [root, { ...root, locale: "ja", isDefault: false }];
const child = { ...root, parentSlug: "site", slug: "site-faq", locale: "ja", isDefault: true };

test("root and child defaults build the same reachable URL independently", () => {
  assert.equal(hostedPagePath(root, roots), "/p/site");
  assert.equal(hostedPagePath(roots[1], roots), "/p/site/ja");
  assert.equal(hostedPagePath(child, roots), "/p/site/site-faq");
  assert.equal(hostedPagePath({ ...child, locale: "en", isDefault: false }, roots), "/p/site/en/site-faq");
  assert.equal(hostedPageUrl(child, roots, "https://example.com/"), "https://example.com/p/site/site-faq");
});

test("alternates omit children without a published parent locale and keep a reachable default", () => {
  const french = { ...child, locale: "fr", isDefault: false };
  assert.equal(hostedPagePath(french, roots), null);
  assert.equal(hostedPagePath({ ...child, organizationId: "other" }, roots), null);
  assert.equal(hostedPagePath(child, []), null);
  assert.deepEqual(hostedAlternates([child, french], roots), {
    ja: "https://appai.info/p/site/site-faq", "x-default": "https://appai.info/p/site/site-faq",
  });
  assert.equal(hostedPagePath({ ...child, locale: "fr" }, roots), "/p/site/site-faq");
});

test("policies advertise only locales containing that policy", () => {
  const variants = [{ ...root, privacyPolicy: "Privacy" }, { ...roots[1], termsOfService: "Terms" }];
  assert.equal(hostedPagePath(variants[0], roots, "terms"), null);
  assert.deepEqual(hostedAlternates(variants, roots, "https://appai.info", "privacy"), {
    en: "https://appai.info/p/site/privacy", "x-default": "https://appai.info/p/site/privacy",
  });
  assert.deepEqual(hostedAlternates(variants, roots, "https://appai.info", "terms"), { ja: "https://appai.info/p/site/ja/terms" });
});

test("external canonical pages do not advertise local marketing alternates", () => {
  const external = { ...root, canonicalUrl: "https://example.org/official" };
  assert.equal(hasExternalCanonical(external), true);
  assert.deepEqual(hostedAlternates([external], roots), {});
  for (const canonicalUrl of [null, "bad URL", "https://appai.info/p/site", "https://www.appai.info/p/site"]) {
    assert.equal(hasExternalCanonical({ ...root, canonicalUrl }), false);
  }
});

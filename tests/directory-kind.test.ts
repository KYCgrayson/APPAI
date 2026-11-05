import assert from "node:assert/strict";
import test from "node:test";
import { inferDirectoryKind } from "../src/lib/directory-kind.ts";

const storeContent = { sections: [{ type: "hero", data: { ctaUrl: "https://apps.apple.com/app/example" } }] };

test("appType beats tags, legacy overrides, tools and store links", () => {
  assert.equal(inferDirectoryKind({ appType: "inventory", tags: ["appai:kind:website"], hostedPageSlug: "demo-profile", sectionTypes: ["tool"], content: storeContent }), "apps");
});

test("explicit tags beat legacy overrides, tools and store links", () => {
  for (const [tag, kind] of [["website", "websites"], ["tool", "tools"], ["app", "apps"]] as const) {
    assert.equal(inferDirectoryKind({ tags: [`appai:kind:${tag}`], hostedPageSlug: "demo-profile", sectionTypes: ["tool"], content: storeContent }), kind);
  }
  assert.equal(inferDirectoryKind({ tags: ["appai:kind:website"], hostedPageSlug: "shiftsnap" }), "websites");
});

test("reviewed legacy slugs beat tool and app signals", () => {
  for (const hostedPageSlug of ["demo-profile", "demo-portfolio", "demo-links", "demo-event"]) {
    assert.equal(inferDirectoryKind({ hostedPageSlug, sectionTypes: ["tool", "download"], content: storeContent }), "websites");
  }
  for (const hostedPageSlug of ["shiftsnap", "simpleshop"]) {
    assert.equal(inferDirectoryKind({ hostedPageSlug, sectionTypes: ["tool"] }), "apps");
  }
});

test("every tool section beats store links and download sections", () => {
  for (const section of ["iframe-tool", "tool", "media-downloader", "video-subtitle"]) {
    assert.equal(inferDirectoryKind({ sectionTypes: [section, "download"], content: storeContent }), "tools");
  }
});

test("download sections and either App row store URL signal apps", () => {
  assert.equal(inferDirectoryKind({ sectionTypes: ["download"] }), "apps");
  assert.equal(inferDirectoryKind({ iosUrl: "https://example.com/ios" }), "apps");
  assert.equal(inferDirectoryKind({ androidUrl: "https://example.com/android" }), "apps");
});

test("store links are detected in top-level fields, download data and arbitrary nested strings", () => {
  for (const host of ["apps.apple.com", "itunes.apple.com", "play.google.com", "testflight.apple.com"]) {
    const url = `https://${host}/app/example`;
    assert.equal(inferDirectoryKind({ url }), "apps");
    for (const content of [
      { appStoreUrl: url }, { playStoreUrl: url },
      { sections: [{ type: "download", data: { appStoreUrl: url } }] },
      { nested: [{ text: `Try [the app](${url}) today.` }] },
    ]) assert.equal(inferDirectoryKind({ content }), "apps");
  }
});

test("all templates default to websites without app signals; unrelated hosts do not count", () => {
  for (const template of [undefined, "APP_LANDING", "PERSON", "PORTFOLIO", "PRODUCT_SHOWCASE", "COMPANY_PROFILE", "LINK_IN_BIO"]) {
    assert.equal(inferDirectoryKind({ template }), "websites");
  }
  for (const url of ["https://apps.apple.com.example.com/app", "https://example.com/apps.apple.com", "https://apps.apple.com@example.com/app"]) {
    assert.equal(inferDirectoryKind({ content: { url } }), "websites");
    assert.equal(inferDirectoryKind({ url }), "websites");
  }
  assert.equal(inferDirectoryKind({ tags: ["appai:kind:invalid"], content: null }), "websites");
});

import assert from "node:assert/strict";
import test from "node:test";
import { createElement, Suspense } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { PassThrough } from "node:stream";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";

const hooks = registerHostedRenderLoader();
const { PageRenderer } = await import("../src/templates/shared/PageRenderer.tsx");
const { SectionErrorBoundary } = await import("../src/templates/shared/SectionErrorBoundary.tsx");

async function stream(element: React.ReactNode) {
  return new Promise<{ html: string; errors: unknown[] }>((resolve, reject) => {
    const chunks: string[] = [];
    const errors: unknown[] = [];
    const output = new PassThrough();
    output.on("data", chunk => chunks.push(chunk.toString()));
    output.on("end", () => resolve({ html: chunks.join(""), errors }));
    output.on("error", reject);
    const rendering = renderToPipeableStream(element, {
      onAllReady() { rendering.pipe(output); },
      onError(error) { errors.push(error); },
      onShellError: reject,
    });
  });
}

test("malformed agent sections cannot take down valid neighboring sections", async () => {
  const result = await stream(createElement(PageRenderer, { page: {
    slug: "example", title: "Example", template: "APP_LANDING", content: { sections: [
      null, "broken", { type: "hero", data: null },
      { type: "features", data: { items: "broken" } },
      { type: "pricing", data: { items: [{ price: 123, features: {} }] } },
      { type: "team", data: { items: [null, "broken", { name: 123 }] } },
      { type: "links", data: { items: [{ title: "Bad link", rel: {} }] } },
      { type: "about", data: { text: "Surviving content" } },
    ] },
  } }));
  assert.match(result.html, /Surviving content/);


});

test("Suspense contains an unexpected SSR section exception", async () => {
  function BrokenSection(): never { throw new Error("Fixture section failure"); }
  const result = await stream(createElement("main", null,
    createElement(SectionErrorBoundary, { sectionType: "fixture", children:
      createElement(Suspense, { fallback: null }, createElement(BrokenSection)) }),
    createElement("p", null, "Surviving sibling"),
  ));
  assert.match(result.html, /Surviving sibling/);
  assert.equal(result.errors.length, 1);
});
test.after(() => hooks.deregister());

test("root/child resolution converts only published, organization-scoped variants", async () => {
  const { fixtureDb } = await import("./helpers/hosted-render-loader.mjs");
  const { resolvePage, resolveChildPage } = await import("../src/lib/hosted-page-resolver.ts");
  fixtureDb.rows = [
    { slug: "example", parentSlug: null, organizationId: "fixture-org", locale: "zh-TW", title: "網站", isDefault: true, isPublished: true },
    { slug: "example", parentSlug: null, organizationId: "fixture-org", locale: "zh-CN", title: "Draft", isDefault: false, isPublished: false },
    { slug: "child", parentSlug: "example", organizationId: "fixture-org", locale: "zh-TW", title: "網站", isDefault: true, isPublished: true },
  ];
  const root = await resolvePage("example", "zh-CN");
  assert.equal(root?.title, "网站");
  assert.equal(root?.autoConverted, true);
  assert.equal((await resolvePage("example", null))?.locale, "zh-TW");
  assert.equal((await resolveChildPage("example", "child", "zh-CN", "fixture-org"))?.title, "网站");
  assert.equal(await resolveChildPage("example", "child", "zh-CN", "other-org"), null);
  assert.equal(fixtureDb.rows[0].locale, "zh-TW");
});

test("converted hosted route renders matching chrome, notice, switcher, and noindex", async () => {
  const { fixtureDb } = await import("./helpers/hosted-render-loader.mjs");
  const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
  const { default: HostedPage, generateMetadata } = await import("../src/app/p/[...segments]/page.tsx");
  for (const [source, requested, title, expected, notice] of [
    ["zh-TW", "zh-CN", "網站", "网站", "此页由繁体中文自动转换"],
    ["zh-CN", "zh-TW", "网站", "網站", "此頁由簡體中文自動轉換"],
  ]) {
    fixtureDb.rows = [{ id: "fixture-page", organizationId: "fixture-org", slug: "example", parentSlug: null,
      locale: source, title, tagline: title, content: { sections: [{ type: "hero", data: { headline: title } }] },
      isDefault: true, isPublished: true, hideFromNav: false, createdAt: new Date(), updatedAt: new Date() }];
    const params = Promise.resolve({ segments: ["example", requested] });
    const child = await HostedPage({ params });
    const html = (await stream(await Layout({ params, children: child }))).html;
    assert.match(html, new RegExp(notice));
    assert.match(html, new RegExp(expected));
    assert.match(html, new RegExp(`/p/example/${requested}`));
    assert.deepEqual((await generateMetadata({ params })).robots, { index: false, follow: true });
    const legalParams = Promise.resolve({ segments: ["example", requested, "privacy"] });
    assert.deepEqual((await generateMetadata({ params: legalParams })).robots, { index: false, follow: true });
  }
});

test("malformed nav is ignored and non-string targets are harmless", async () => {
  const { buildNav, resolveNavHref } = await import("../src/lib/site-nav.ts");
  assert.deepEqual(buildNav({ nav: [null, "broken", { label: {}, target: 1 }, { label: "Example", target: "#example" }] }, [], "/p/example", "en"), [{ label: "Example", target: "#example" }]);
  assert.deepEqual(resolveNavHref(42 as never, "example", ""), { href: "#", external: false });
});

test("off-spec harmless section data retains sections and valid content", async () => {
  const cases = [
    { type: "stats", data: { items: [{ value: 99, label: "Valid stats" }] }, expected: /99[\s\S]*?Valid stats/ },
    { type: "pricing", data: { items: [{ name: "Valid pricing", price: "$1", highlighted: "true", features: [] }] }, expected: /Valid pricing/ },
    { type: "profile-header", data: { name: "Valid profile", links: [null, { label: "Valid link", url: "https://example.test" }] }, expected: /Valid profile[\s\S]*?Valid link/ },
    { type: "project-cards", data: { items: [{ name: "Valid project", screenshot: { url: "https://example.test/image.png", width: "300" } }] }, expected: /Valid project/ },
    { type: "screenshots", data: { images: [{ url: "https://example.test/screen.png", alt: "Valid screen", width: "300" }] }, expected: /Valid screen/ },
    { type: "iframe-tool", data: { heading: "Valid iframe", src: "https://example.test", allowFullscreen: "true" }, expected: /Valid iframe/ },
    { type: "entries", data: { heading: {}, items: [{ title: "Valid entry" }] }, expected: /Valid entry/ },
  ];
  for (const { expected, ...section } of cases) {
    const result = await stream(createElement(PageRenderer, { page: { slug: "fixture", title: "Fixture", template: "APP_LANDING", content: { sections: [section] } } }));
    assert.match(result.html, expected, section.type);
    assert.equal(result.errors.length, 0, section.type);
  }
});

test("notice and noindex follow the rendered child independently of the root", async () => {
  const { fixtureDb } = await import("./helpers/hosted-render-loader.mjs");
  const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
  const { generateMetadata } = await import("../src/app/p/[...segments]/page.tsx");
  for (const childConverted of [false, true]) {
    const base = { organizationId: "fixture-org", isPublished: true, isDefault: true, title: "網站", content: {}, createdAt: new Date(), updatedAt: new Date() };
    fixtureDb.rows = [
      { ...base, slug: "example", parentSlug: null, locale: childConverted ? "zh-CN" : "zh-TW" },
      { ...base, slug: "child", parentSlug: "example", locale: childConverted ? "zh-TW" : "zh-CN" },
    ];
    const params = Promise.resolve({ segments: ["example", "zh-CN", "child"] });
    const html = (await stream(await Layout({ params, children: createElement("p", null, "Child content") }))).html;
    assert.equal(html.includes("此页由繁体中文自动转换"), childConverted);
    assert.deepEqual((await generateMetadata({ params })).robots, childConverted ? { index: false, follow: true } : undefined);
  }
});

test("numeric string section orders render FIRST before SECOND", async () => {
  const result = await stream(createElement(PageRenderer, { page: {
    slug: "ordered", title: "Ordered", template: "APP_LANDING", content: { sections: [
      { type: "about", order: "2", data: { text: "SECOND" } },
      { type: "about", order: "1", data: { text: "FIRST" } },
    ] },
  } }));
  assert.match(result.html, /FIRST[\s\S]*SECOND/);
  assert.equal(result.errors.length, 0);
});

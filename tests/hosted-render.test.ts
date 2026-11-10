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
    createElement(SectionErrorBoundary, { sectionType: "fixture" },
      createElement(Suspense, { fallback: null }, createElement(BrokenSection))),
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

test("default typography matches the baseline with optional links heading for all 29 section types", async (t) => {
  t.mock.method(Date.prototype, "toISOString", () => "2026-01-01T00:00:00.000Z");
  const { readFileSync } = await import("node:fs");
  const page = JSON.parse(readFileSync(new URL("./fixtures/typography-page.json", import.meta.url), "utf8"));
  const expected = readFileSync(new URL("./fixtures/typography-default.html", import.meta.url), "utf8");
  assert.equal(new Set(page.content.sections.map((section: { type: string }) => section.type)).size, 29);
  for (const settings of [{}, { textSize: "md", textContrast: "normal" }, { textSize: "md", textContrast: "normal", typography: {} }, { textSize: "md", textContrast: "normal", typography: { caption: "md", card: "md", body: "md", heading: "md", display: "md" } }]) {
    const result = await stream(createElement(PageRenderer, { page: { ...page, content: { ...page.content, ...settings } } }));
    assert.equal(result.errors.length, 0);
    assert.equal(result.html, expected);
    assert.doesNotMatch(result.html, /data-typography|--type-/);
  }
  const active = await stream(createElement(PageRenderer, { page: { ...page, content: { ...page.content, textSize: "4xl", textContrast: "high", typography: { display: "4xl" } } } }));
  for (const role of ["display", "heading", "card", "body"]) assert.ok(active.html.includes(`data-typography-role="${role}"`));
  assert.match(active.html, /overflow-wrap:anywhere/);
  assert.match(active.html, /--ts-display:2.5/);
});

test("extreme hero and contact text render with active shrink and wrap rules", async () => {
  const result = await stream(createElement(PageRenderer, { page: {
    slug: "long-typography", title: "Long typography", template: "APP_LANDING", content: {
      textSize: "4xl", textContrast: "high", sections: [
        { type: "hero", order: 0, data: { headline: "Internationalization", subheadline: "Internationalization" } },
        { type: "contact", order: 1, data: { email: "Internationalization@internationalization.example.com" } },
      ],
    },
  } }));
  assert.equal(result.errors.length, 0);
  assert.match(result.html, /Internationalization/);
  assert.match(result.html, /Internationalization@internationalization.example.com/);
  assert.match(result.html, /\[data-typography-role\]\{overflow-wrap:anywhere;min-width:0\}/);
  assert.match(result.html, /relative z-10 max-w-3xl min-w-0/);
  assert.match(result.html, /<div class="min-w-0"><p data-typography-role="caption"/);
});

 test("render version opts existing headings and hero store CTA into new behavior", async () => {
  const sections = [
    { type: "pricing", data: { heading: "Custom pricing", subheading: "Pricing detail", items: [{ name: "Free", price: "0", features: [] }] } },
    { type: "faq", data: { heading: "Custom FAQ", subheading: "FAQ detail", items: [{ question: "Why?", answer: "Because" }] } },
    { type: "embed", data: { heading: "Custom embed", subheading: "Embed detail", title: "Original embed title", url: "https://youtu.be/abc" } },
    { type: "hero", data: { headline: "App", ctaText: "Custom download", ctaUrl: "https://apps.apple.com/app/id123" } },
  ];
  const render = async (content: unknown) => (await stream(createElement(PageRenderer, { page: { slug: "versions", title: "Versions", template: "APP_LANDING", content } }))).html;
  const old = await render({ sections });
  const original = await render({ sections: sections.map(s => { const { heading, subheading, ...data } = s.data; return { ...s, data }; }) });
  assert.equal(old, original);
  assert.match(old, />Pricing<\/h2>/);
  assert.match(old, />FAQ<\/h2>/);
  assert.match(old, /Original embed title/);
  assert.match(old, />Custom download<\/a>/);
  assert.doesNotMatch(old, /aria-label="Download on the App Store"/);
  for (const renderVersion of [2, 3]) {
    const modern = await render({ sections, renderVersion });
    for (const heading of ["Custom pricing", "Custom FAQ", "Custom embed"]) assert.ok(modern.includes(heading));
    assert.match(modern, /aria-label="Download on the App Store"/);
    assert.doesNotMatch(modern, /Original embed title|>Custom download<\/a>/);
  }
 });

test("legacy features, contact and links retain their previously supported subheadings", async () => {
  for (const type of ["features", "contact", "links"]) {
    const result = await stream(createElement(PageRenderer, { page: {
      slug: "legacy-subheadings", title: "Legacy", template: "APP_LANDING", content: { sections: [
        { type, data: { heading: "Existing heading", subheading: "Existing supporting copy", items: [{ title: "Item", label: "Link", url: "https://example.com" }] } },
      ] },
    } }));
    assert.equal(result.errors.length, 0);
    assert.match(result.html, /Existing supporting copy/, type);
  }
});

test("hosted SEO shares child URLs with schema and omits unreachable locales", async () => {
  const { fixtureDb } = await import("./helpers/hosted-render-loader.mjs");
  const { default: HostedPage, generateMetadata } = await import("../src/app/p/[...segments]/page.tsx");
  const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
  const root = { id: "root", organizationId: "fixture-org", slug: "seo-site", parentSlug: null,
    locale: "en", title: "Example", isDefault: true, isPublished: true, content: {},
    createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-02-01") };
  fixtureDb.rows = [root, { ...root, id: "ja-root", locale: "ja", isDefault: false },
    { ...root, id: "child", slug: "seo-faq", parentSlug: "seo-site", title: "FAQ", locale: "ja" },
    { ...root, id: "fr-child", slug: "seo-faq", parentSlug: "seo-site", title: "French FAQ", locale: "fr", isDefault: false },
    { ...root, id: "en-child", slug: "seo-faq", parentSlug: "seo-site", title: "English FAQ", isDefault: false },
  ];
  for (const segments of [["seo-site", "seo-faq"], ["seo-site", "en", "seo-faq"], ["seo-site", "ja", "seo-faq"]]) {
    const params = Promise.resolve({ segments });
    const metadata = await generateMetadata({ params });
    const html = (await stream(await HostedPage({ params }))).html;
    assert.ok(html.includes(`"url":"${metadata.alternates!.canonical}"`));
    assert.deepEqual(metadata.alternates?.languages, { ja: "https://appai.info/p/seo-site/seo-faq",
      "x-default": "https://appai.info/p/seo-site/seo-faq", en: "https://appai.info/p/seo-site/en/seo-faq" });
    const chrome = (await stream(await Layout({ params, children: null }))).html;
    assert.ok(!chrome.includes("/p/seo-site/fr/seo-faq"));
    assert.ok(chrome.includes("/p/seo-site/en/seo-faq"));
  }
});

test("automatic sibling navigation keeps the requested Japanese and converted Chinese locale", async () => {
  const { fixtureDb } = await import("./helpers/hosted-render-loader.mjs");
  const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
  const { buildNav, resolveNavHref } = await import("../src/lib/site-nav.ts");
  for (const locale of ["ja", "zh-TW"]) {
    const root = { organizationId: "fixture-org", slug: "nav-site", parentSlug: null,
      locale: locale === "ja" ? "ja" : "zh-CN", title: "Site", isDefault: locale !== "ja", isPublished: true,
      content: {}, createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-02-01") };
    const sibling = { ...root, slug: "nav-faq", parentSlug: "nav-site", locale: locale === "ja" ? "en" : "zh-CN",
      title: "FAQ", isDefault: true, hideFromNav: false, navOrder: 0 };
    fixtureDb.rows = [root, sibling];
    const items = buildNav({}, [sibling], `/p/nav-site/${locale}`, locale);
    assert.equal(items[1].target, "nav-faq");
    assert.deepEqual(resolveNavHref(items[1].target, "nav-site", locale), { href: `/p/nav-site/${locale}/nav-faq`, external: false });
    for (const segments of [["nav-site", locale], ["nav-site", locale, "nav-faq"]]) {
      const result = await stream(await Layout({ params: Promise.resolve({ segments }), children: null }));
      assert.equal(result.errors.length, 0);
      assert.ok(result.html.includes(`href="/p/nav-site/${locale}/nav-faq"`));
      assert.ok(!result.html.includes('href="/p/nav-site/nav-faq"'));
    }
  }
});

test("a root's default locale does not make a reachable nondefault child fall through to notFound", async () => {
  const { fixtureDb } = await import("./helpers/hosted-render-loader.mjs");
  const { default: HostedPage, generateMetadata } = await import("../src/app/p/[...segments]/page.tsx");
  const root = { organizationId: "fixture-org", slug: "fallback-site", parentSlug: null,
    locale: "en", title: "English root", isDefault: true, isPublished: true, content: {},
    createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-02-01") };
  for (const hasParentLocale of [false, true]) {
    fixtureDb.rows = [root, ...(hasParentLocale ? [{ ...root, locale: "ja", isDefault: false }] : []),
      { ...root, slug: "fallback-faq", parentSlug: "fallback-site", locale: "ja", isDefault: false,
        title: "Japanese child", content: { sections: [{ type: "hero", data: { headline: "Japanese child" } }] } }];
    const params = Promise.resolve({ segments: ["fallback-site", "fallback-faq"] });
    const metadata = await generateMetadata({ params });
    assert.equal(metadata.alternates?.canonical, `https://appai.info/p/fallback-site/${hasParentLocale ? "ja/" : ""}fallback-faq`);
    const result = await stream(await HostedPage({ params }));
    assert.equal(result.errors.length, 0);
    assert.match(result.html, /Japanese child/);
    assert.ok(result.html.includes(`"url":"${metadata.alternates?.canonical}"`));
  }
});

test("a converted parent also permits its nondefault child and supplies matching metadata", async () => {
  const { fixtureDb } = await import("./helpers/hosted-render-loader.mjs");
  const { default: HostedPage, generateMetadata } = await import("../src/app/p/[...segments]/page.tsx");
  const root = { organizationId: "fixture-org", slug: "converted-site", parentSlug: null,
    locale: "zh-CN", title: "网站", isDefault: true, isPublished: true, content: {},
    createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-02-01") };
  fixtureDb.rows = [root, { ...root, slug: "converted-faq", parentSlug: "converted-site", isDefault: false,
    content: { sections: [{ type: "hero", data: { headline: "网站" } }] } }];
  const params = Promise.resolve({ segments: ["converted-site", "zh-TW", "converted-faq"] });
  const metadata = await generateMetadata({ params });
  assert.equal(metadata.alternates?.canonical, "https://appai.info/p/converted-site/zh-TW/converted-faq");
  const result = await stream(await HostedPage({ params }));
  assert.equal(result.errors.length, 0);
  assert.match(result.html, /網站/);
  assert.ok(result.html.includes(`"url":"${metadata.alternates?.canonical}"`));
});

test("legal metadata, schema and language switcher keep policy paths and only existing policies", async () => {
  const { fixtureDb } = await import("./helpers/hosted-render-loader.mjs");
  const { default: HostedPage, generateMetadata } = await import("../src/app/p/[...segments]/page.tsx");
  const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
  const root = { id: "root", organizationId: "fixture-org", slug: "legal-site", parentSlug: null,
    locale: "en", title: "Example", isDefault: true, isPublished: true, content: {},
    privacyPolicy: "Privacy", termsOfService: "Terms", createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-02-01") };
  fixtureDb.rows = [root, { ...root, locale: "ja", isDefault: false, termsOfService: null },
    { ...root, locale: "fr", isDefault: false, privacyPolicy: null }];
  for (const policy of ["privacy", "terms"]) {
    const params = Promise.resolve({ segments: ["legal-site", policy] });
    const metadata = await generateMetadata({ params });
    assert.match(String(metadata.title), policy === "privacy" ? /Privacy Policy.*Example/ : /Terms of Service.*Example/);
    assert.ok(metadata.description?.includes("Example"));
    assert.equal(metadata.alternates?.canonical, `https://appai.info/p/legal-site/${policy}`);
    assert.equal(Object.keys(metadata.alternates!.languages!).length, 3);
    assert.ok(!Object.hasOwn(metadata.alternates!.languages!, policy === "privacy" ? "fr" : "ja"));
    const html = (await stream(await HostedPage({ params }))).html;
    assert.ok(html.includes(`"url":"${metadata.alternates!.canonical}"`));
    const chrome = (await stream(await Layout({ params, children: null }))).html;
    assert.ok(chrome.includes(`/p/legal-site/${policy === "privacy" ? "ja" : "fr"}/${policy}`));
    assert.ok(!chrome.includes(`/p/legal-site/${policy === "privacy" ? "fr" : "ja"}/${policy}`));
  }
});

test("external hosted canonical is also the schema identity", async () => {
  const { fixtureDb } = await import("./helpers/hosted-render-loader.mjs");
  const { default: HostedPage, generateMetadata } = await import("../src/app/p/[...segments]/page.tsx");
  fixtureDb.rows = [{ organizationId: "fixture-org", slug: "canonical-site", parentSlug: null,
    locale: "en", title: "Example", isDefault: true, isPublished: true, content: {}, canonicalUrl: "https://example.org/official" }];
  const params = Promise.resolve({ segments: ["canonical-site", "en"] });
  assert.equal((await generateMetadata({ params })).alternates?.languages, undefined);
  const html = (await stream(await HostedPage({ params }))).html;
  assert.ok(html.includes('"url":"https://example.org/official"'));
});

test("H1 preview warnings agree with rendered sections including legacy and markdown", async () => {
  const { pageHeadingWarnings } = await import("../src/lib/section-field-warnings.ts");
  for (const content of [{}, { sections: [{ type: "features", data: { items: [] } }] },
    { sections: [{ type: "hero", data: {} }, { type: "profile-header", data: { name: "Jordan" } }] },
    { sections: [{ type: "profile-header", data: { name: "  " } }, { type: "about", data: { text: "# Not an H1" } }] },
  ]) {
    const html = (await stream(createElement(PageRenderer, { page: { slug: "fixture", title: "Fixture", template: "APP_LANDING", content } }))).html;
    const count = (html.match(/<h1[\s>]/g) || []).length;
    const warnings = pageHeadingWarnings(content);
    assert.equal(warnings.length, count === 1 ? 0 : 1);
    if (warnings.length) assert.ok(warnings[0].message.includes(`renders ${count} H1`));
  }
});

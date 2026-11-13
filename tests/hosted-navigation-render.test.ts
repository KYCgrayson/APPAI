import assert from "node:assert/strict";
import test from "node:test";
import { renderHtml } from "./helpers/render-html.mjs";
import { fixtureDb, registerHostedHeaders, registerHostedRenderLoader, registerHostedNavigationState } from "./helpers/hosted-render-loader.mjs";

const loader = registerHostedRenderLoader();
const headers = registerHostedHeaders();
const state = {
  open: false, user: null as null | { id: string; name: string },
  measure: null as null | { ref: { current: unknown }; effects: (() => void | (() => void))[] },
};
// Render the real drawer and links with fixture auth and initial menu state.
const hooks = registerHostedNavigationState(state);

test.after(() => { hooks.deregister(); headers.deregister(); loader.deregister(); });

const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
const { default: HostedPage } = await import("../src/app/p/[...segments]/page.tsx");
const { default: NotFound } = await import("../src/app/p/[...segments]/not-found.tsx");
const { buildNav } = await import("../src/lib/site-nav.ts");
const { hostedNavigationCopy } = await import("../src/lib/hosted-navigation-copy.ts");
const { AdaptiveChrome } = await import("../src/app/p/[...segments]/AdaptiveChrome.tsx");
const { isUnavailableHostedPolicyLink } = await import("../src/lib/hosted-page-urls.ts");

function root(locale: string) {
  return {
    id: `root-${locale}`, organizationId: "navigation-fixture", slug: "navigation-site", parentSlug: null,
    locale, title: locale === "en" ? "A long publisher site name" : "這是一個很長的繁體中文網站名稱與作品集",
    isDefault: locale === "en", isPublished: true, hideFromNav: false, navOrder: null,
    template: "APP_LANDING", content: { logo: "/appai-logo2.png", sections: [{ type: "about", data: { text: "Fixture body" }, order: 0 }] },
    privacyPolicy: "Fixture privacy text", termsOfService: "", darkMode: false, themeColor: "#ffff00",
    createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-01-02"),
  };
}

function seed(locale: string, visibleChildren: boolean) {
  const page = root(locale);
  fixtureDb.rows = [root("en"), root("zh-TW"), {
    ...page, id: `child-${locale}`, slug: "site-contact", parentSlug: page.slug,
    title: "Contact fixture", hideFromNav: !visibleChildren,
  }];
  state.open = false;
  state.user = null;
}

function path(locale: string, suffix = "") {
  return `/p/navigation-site${locale === "en" ? "" : `/${locale}`}${suffix ? `/${suffix}` : ""}`;
}

async function render(locale: string, suffix = "", expect404 = false) {
  fixtureDb.hostedPath = path(locale, suffix);
  const params = Promise.resolve({ segments: fixtureDb.hostedPath.slice(3).split("/") });
  const children = expect404
    ? (await assert.rejects(() => HostedPage({ params }), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }), await NotFound())
    : await HostedPage({ params });
  return renderHtml(await Layout({ params, children }));
}

function anchors(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(match => ({
    attributes: match[1], href: match[1].match(/href="([^"]*)"/)?.[1], text: match[2].replace(/<[^>]+>/g, "").trim(),
  }));
}

for (const locale of ["en", "zh-TW"]) {
  for (const kind of ["root", "child without siblings", "child with siblings", "privacy", "terms", "404"] as const) {
    test(`${locale}: ${kind} keeps publisher Home and AppAI reachable in the header and drawer`, async () => {
      seed(locale, kind === "child with siblings");
      const suffix = kind.startsWith("child") ? "site-contact" : kind === "root" ? "" : kind;
      if (kind === "terms") for (const row of fixtureDb.rows) row.termsOfService = "Fixture terms text";
      for (const open of [false, true]) {
        state.open = open;
        const html = await render(locale, suffix, kind === "404");
        const header = html.match(/<header\b[\s\S]*?<\/header>/)![0];
        const links = anchors(header);
        const home = hostedNavigationCopy(locale).home;
        assert.equal(links[0].href, path(locale), "publisher name still links home");
        assert.match(links[0].attributes, /min-h-11/);
        assert.match(header, /min-w-16 font-semibold text-lg truncate/);
        if (kind === "root") {
          assert.match(links[0].attributes, /aria-current="page"/);
          assert.equal(links.filter(link => link.text === home).length, 0, "no Home-only root nav");
        } else {
          assert.equal(links[1].text, home, "Home immediately follows branding");
          assert.equal(links[1].href, path(locale));
          assert.doesNotMatch(links[1].attributes, /aria-current|hidden/);
          assert.match(links[1].attributes, /min-h-11 min-w-11/);
          assert.match(links[1].attributes, /focus-visible:ring-2/);
          const nav = header.match(/<nav\b[\s\S]*?<\/nav>/)![0];
          assert.ok(anchors(nav).some(link => link.text === home && link.href === path(locale)));
          if (kind === "404") assert.doesNotMatch(nav, /aria-current="page"/);
        }
        assert.ok(links.some(link => link.text === "AppAI" && link.href === "/" && link.attributes.includes("md:inline-flex")), "desktop platform link");
        if (open) {
          assert.ok(links.some(link => link.text === "AppAI" && link.href === "/" && link.attributes.includes("block min-h-11")), "drawer platform link");
          assert.match(header, /aria-expanded="true"/);
        }
        const footer = html.match(/<footer\b[\s\S]*?<\/footer>/)![0];
        assert.ok(anchors(footer).some(link => link.href === "/" && link.text.includes("AppAI")));
        if (kind !== "terms") assert.doesNotMatch(html, /href="[^"]*\/terms"/);
        if (kind === "privacy" || kind === "terms") {
          assert.ok(links.some(link => link.href === path(locale, kind) && link.attributes.includes('aria-current="page"')));
        }
        if (kind === "404") {
          const fallback = html.match(/<section\b[\s\S]*?<\/section>/)![0];
          assert.ok(anchors(fallback).some(link => link.text === home && link.href === path(locale)));
          assert.ok(anchors(fallback).some(link => link.text === "AppAI" && link.href === "/"));
          assert.ok(fallback.includes(hostedNavigationCopy(locale).notFound));
        }
      }
    });
  }

  test(`${locale}: empty/whitespace policies 404 and disappear from explicit nav, header and footer`, async () => {
    for (const empty of ["", " \n\t "]) {
      seed(locale, false);
      for (const row of fixtureDb.rows) {
        row.privacyPolicy = empty;
        row.termsOfService = empty;
        row.content = { sections: [], nav: [
          { label: "Privacy", target: "privacy" }, { label: "Terms", target: path(locale, "terms") },
          { label: "English privacy", target: "https://appai.info/p/navigation-site/privacy" },
        ] };
      }
      state.open = true;
      for (const suffix of ["", "site-contact", "privacy", "terms"]) {
        const html = await render(locale, suffix, suffix === "privacy" || suffix === "terms");
        assert.doesNotMatch(html, /href="[^"]*\/(privacy|terms)"/);
        if (!suffix) assert.doesNotMatch(html, /<nav\b/);
      }
    }
  });

  test(`${locale}: existing visible-child nav retains Home, sibling order, labels and hrefs`, async () => {
    seed(locale, true);
    fixtureDb.rows.push({ ...root(locale), slug: "site-faq", parentSlug: "navigation-site", title: "FAQ fixture", navOrder: 1 });
    const expected = [
      [hostedNavigationCopy(locale).home, path(locale)], ["FAQ fixture", path(locale, "site-faq")], ["Contact fixture", path(locale, "site-contact")],
    ];
    for (const suffix of ["", "site-contact"]) {
      const html = await render(locale, suffix);
      const nav = html.match(/<nav\b[\s\S]*?<\/nav>/)![0];
      assert.deepEqual(anchors(nav).map(link => [link.text, link.href]), expected);
      assert.equal(anchors(nav).filter(link => link.attributes.includes('aria-current="page"')).length, 1);
    }
  });
}

test("custom nav gains Home only on non-root pages and preserves an existing Home label", () => {
  assert.deepEqual(buildNav({ nav: [] }, [], "/p/site", "en", false), [{ label: "Home", target: "/p/site" }]);
  const custom = [{ label: "Publisher Home", target: "/p/site" }, { label: "Contact", target: "contact" }];
  assert.deepEqual(buildNav({ nav: custom }, [], "/p/site", "en", false), custom);
  assert.deepEqual(buildNav({ nav: custom.slice(0, 1) }, [], "/p/site", "en"), []);
  assert.equal(isUnavailableHostedPolicyLink("//[", [root("en")]), false, "malformed URLs must not crash hosted chrome");
});

test("404 root recovery uses only public roots, including malformed paths and missing translations", async () => {
  for (const published of [false, true]) {
    fixtureDb.rows = [{ ...root("en"), isPublished: published }];
    for (const requested of ["/p/navigation-site/privacy", "/p/navigation-site/de/missing", "/p/navigation-site/contact/too/deep"]) {
      fixtureDb.hostedPath = requested;
      const html = await renderHtml(await NotFound());
      assert.equal(anchors(html).some(link => link.href === path("en")), published);
      assert.ok(anchors(html).some(link => link.href === "/"));
      assert.doesNotMatch(html, /A long publisher site name/);
    }
  }
  fixtureDb.rows = [{ ...root("en"), parentSlug: "another-site" }];
  assert.doesNotMatch(await renderHtml(await NotFound()), /href="\/p\//);
  fixtureDb.hostedPath = "/p/missing-site/privacy";
  assert.doesNotMatch(await renderHtml(await NotFound()), /href="\/p\//);
});

test("Home matches a default child's own locale and falls back to the available root", async () => {
  seed("zh-TW", false);
  fixtureDb.rows[2].isDefault = true;
  fixtureDb.hostedPath = "/p/navigation-site/site-contact";
  const params = Promise.resolve({ segments: ["navigation-site", "site-contact"] });
  let links = anchors((await renderHtml(await Layout({ params, children: null }))).match(/<header\b[\s\S]*?<\/header>/)![0]);
  assert.equal(links[1].href, path("zh-TW"));
  fixtureDb.rows = fixtureDb.rows.filter(row => row.parentSlug || row.locale === "en");
  links = anchors((await renderHtml(await Layout({ params, children: null }))).match(/<header\b[\s\S]*?<\/header>/)![0]);
  assert.equal(links[1].href, path("en"));
});

test("navigation labels match exact, primary, Chinese script aliases, then English", () => {
  for (const locale of ["en", "zh-TW", "zh-CN", "ja", "ko", "es", "fr", "de"]) {
    const copy = hostedNavigationCopy(locale);
    assert.ok(copy.home && copy.notFound && copy.unavailable && copy.appai);
  }
  assert.equal(hostedNavigationCopy("es-MX").home, "Inicio");
  assert.equal(hostedNavigationCopy("zh-Hant-HK").home, "首頁");
  assert.equal(hostedNavigationCopy("zh-Hans-SG").home, "首页");
  assert.equal(hostedNavigationCopy("xx-YY").home, "Home");
});

test("all hosted templates retain Home and AppAI for signed-in visitors in light and dark themes", async () => {
  for (const template of ["APP_LANDING", "COMPANY_PROFILE", "PRODUCT_SHOWCASE", "LINK_IN_BIO", "PORTFOLIO", "PERSON", "GAME"]) {
    for (const locale of ["en", "zh-TW"]) {
      for (const darkMode of [false, true]) {
        seed(locale, false);
        for (const row of fixtureDb.rows) Object.assign(row, { template, darkMode, themeColor: "#ffffff" });
        state.user = { id: "fixture-user", name: "Long signed-in account name ".repeat(8) };
        state.open = true;
        const html = await render(locale, "site-contact");
        const header = html.match(/<header\b[\s\S]*?<\/header>/)![0];
        assert.equal(anchors(header)[1].text, hostedNavigationCopy(locale).home);
        assert.match(header, /bg-white text-gray-900/);
        assert.match(anchors(header)[1].attributes, /text-gray-700/);
        assert.ok(anchors(header).some(link => link.href === "/" && link.text === "AppAI"));
        assert.ok(anchors(header).some(link => link.href === "/dashboard"));
      }
    }
  }
});

test("explicit default-locale child URLs mark the canonical sibling link as current", async () => {
  seed("en", true);
  const params = Promise.resolve({ segments: ["navigation-site", "en", "site-contact"] });
  const html = await renderHtml(await Layout({ params, children: null }));
  const nav = html.match(/<nav\b[\s\S]*?<\/nav>/)![0];
  assert.ok(anchors(nav).some(link => link.href === path("en", "site-contact") && link.attributes.includes('aria-current="page"')));
});

test("repeated overflow measurements keep the compact header until space is available", () => {
  const element = { dataset: { cramped: "false" }, scrollWidth: 500, clientWidth: 320 };
  const effects: (() => void | (() => void))[] = [];
  state.measure = { ref: { current: element }, effects };
  const old = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, ResizeObserver: globalThis.ResizeObserver };
  const frames: FrameRequestCallback[] = [];
  let resize = () => {};
  let disconnected = false;
  globalThis.requestAnimationFrame = callback => frames.push(callback);
  globalThis.cancelAnimationFrame = () => {};
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    unobserve() {}
    disconnect() { disconnected = true; }
  } as unknown as typeof ResizeObserver;
  try {
    AdaptiveChrome({ children: null });
    const cleanup = effects[0]();
    frames.shift()!(0);
    assert.equal(element.dataset.cramped, "true");
    resize(); frames.shift()!(0);
    assert.equal(element.dataset.cramped, "true", "a second check must not clear compact mode");
    element.clientWidth = 1024;
    resize(); frames.shift()!(0);
    assert.equal(element.dataset.cramped, "false");
    if (cleanup) cleanup();
    assert.equal(disconnected, true);
  } finally {
    Object.assign(globalThis, old);
    state.measure = null;
  }
});

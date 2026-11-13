import assert from "node:assert/strict";
import test from "node:test";
import { renderHtml } from "./helpers/render-html.mjs";
import { fixtureDb, registerHostedHeaders, registerHostedRenderLoader, registerHostedNavigationState } from "./helpers/hosted-render-loader.mjs";

const loader = registerHostedRenderLoader();
const headers = registerHostedHeaders();
const state = {
  open: false, user: null as null | { id: string; name: string },
};
// Render the real drawer and links with fixture auth and initial menu state.
const hooks = registerHostedNavigationState(state);

test.after(() => { hooks.deregister(); headers.deregister(); loader.deregister(); });

const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
const { default: HostedPage } = await import("../src/app/p/[...segments]/page.tsx");
const { default: NotFound } = await import("../src/app/p/[...segments]/not-found.tsx");
const { buildNav } = await import("../src/lib/site-nav.ts");
const { hostedNavigationCopy } = await import("../src/lib/hosted-navigation-copy.ts");
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
        assert.match(header, /font-semibold text-lg truncate/);
        if (kind === "root") {
          assert.equal(links.filter(link => link.text === home).length, 0, "no Home-only root nav");
        } else {
          assert.equal(links[1].text, home, "Home immediately follows branding");
          assert.equal(links[1].href, path(locale));
          assert.doesNotMatch(links[1].attributes, /aria-current|hidden/);
          assert.match(links[1].attributes, /min-h-11 min-w-11/);
          assert.match(links[1].attributes, /focus-visible:ring-2/);
          assert.equal(links.filter(link => link.text === home).length, 1, "exactly one header Home, including the open drawer");
        }
        assert.ok(links.some(link => link.text === "AppAI" && link.href === "/" && link.attributes.includes("md:inline-flex")), "desktop platform link");
        if (open) {
          assert.ok(links.some(link => link.text === "AppAI" && link.href === "/" && link.attributes.includes("block px-6")), "drawer platform link");
          assert.match(header, /aria-expanded="true"/);
        }
        const footer = html.match(/<footer\b[\s\S]*?<\/footer>/)![0];
        assert.ok(anchors(footer).some(link => link.href === "/" && link.text.includes("AppAI")));
        if (kind !== "terms") assert.doesNotMatch(html, /href="[^"]*\/terms"/);
        assert.equal([...html.matchAll(/<main\b/g)].length, 1);
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
      assert.deepEqual(anchors(nav).map(link => [link.text, link.href]), suffix ? expected.slice(1) : expected);
    }
  });
}

test("custom nav gains Home only on non-root pages and preserves an existing Home label", () => {
  assert.deepEqual(buildNav({ nav: [] }, [], "/p/site", "en", false), [{ label: "Home", target: "/p/site" }]);
  const custom = [{ label: "Publisher Home", target: "/p/site" }, { label: "Contact", target: "contact" }];
  assert.deepEqual(buildNav({ nav: custom }, [], "/p/site", "en", false), custom);
  assert.deepEqual(buildNav({ nav: custom.slice(0, 1) }, [], "/p/site", "en"), custom.slice(0, 1));
  assert.equal(isUnavailableHostedPolicyLink("//[", [root("en")]), false, "malformed URLs must not crash hosted chrome");
});

test("404 root recovery uses only public roots, including malformed paths and missing translations", async () => {
  for (const published of [false, true]) {
    fixtureDb.rows = [{ ...root("en"), isPublished: published }];
    for (const requested of ["/p/navigation-site/privacy", "/p/navigation-site/de/missing", "/p/navigation-site/contact/too/deep"]) {
      fixtureDb.hostedPath = requested;
      const params = Promise.resolve({ segments: requested.slice(3).split("/") });
      const html = await renderHtml(await Layout({ params, children: await NotFound() }));
      assert.equal([...html.matchAll(/<main\b/g)].length, 1, requested);
      assert.equal(anchors(html).some(link => link.href === path("en")), published);
      assert.ok(anchors(html).some(link => link.href === "/"));
      if (!published) assert.doesNotMatch(html, /A long publisher site name/);
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
  for (const locale of ["zh", "zh-CN", "zh-SG", "zh-Hans", "zh-Hans-SG", "ZH-cn"]) {
    assert.equal(hostedNavigationCopy(locale).home, "首页", locale);
    assert.equal(hostedNavigationCopy(locale).language, "语言", locale);
  }
  for (const locale of ["zh-TW", "zh-HK", "zh-MO", "zh-Hant", "zh-Hant-HK", "ZH-tw"]) {
    assert.equal(hostedNavigationCopy(locale).home, "首頁", locale);
    assert.equal(hostedNavigationCopy(locale).language, "語言", locale);
  }
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
        assert.match(header, /bg-white\/90 backdrop-blur-sm/);
        assert.match(anchors(header)[1].attributes, /text-gray-700/);
        assert.ok(anchors(header).some(link => link.href === "/" && link.text === "AppAI"));
        assert.ok(anchors(header).some(link => link.href === "/dashboard"));
      }
    }
  }
});

test("every 404 layout variant has exactly one main landmark", async () => {
  for (const published of [false, true]) {
    fixtureDb.rows = [{ ...root("en"), isPublished: published }];
    for (const requested of ["", "/p/missing-site", "/p/navigation-site", "/p/navigation-site/missing-child",
      "/p/navigation-site/de/missing", "/p/navigation-site/privacy", "/p/navigation-site/terms",
      "/p/navigation-site/contact/too/deep", "/p/navigation-site//missing-child", "/p/navigation-site/tools/0", "/p/navigation-site/tools/invalid"]) {
      fixtureDb.hostedPath = requested;
      const params = Promise.resolve({ segments: requested.slice(3).split("/") });
      const html = await renderHtml(await Layout({ params, children: await NotFound() }));
      assert.equal([...html.matchAll(/<main\b/g)].length, 1, `${requested || "platform"}, published=${published}`);
      assert.equal([...html.matchAll(/<\/main>/g)].length, 1);
    }
  }
});

test("custom Home entries are deduped from both navs while siblings retain their order", async () => {
  seed("en", true);
  fixtureDb.rows[0].content = { sections: [], nav: [
    { label: "Publisher Home", target: path("en") }, { label: "Contact", target: "site-contact" },
    { label: "Home", target: path("en") }, { label: "Details", target: "#details" },
    { label: "Home", target: `https://appai.info${path("en")}/` },
    { label: "Home", target: `${path("en")}/en` },
  ] };
  state.open = true;
  const header = (await render("en", "site-contact")).match(/<header\b[\s\S]*?<\/header>/)![0];
  const links = anchors(header);
  assert.equal(links.filter(link => link.text === "Home").length, 1);
  assert.ok(!links.some(link => link.text === "Publisher Home"));
  assert.deepEqual(anchors(header.match(/<nav\b[\s\S]*?<\/nav>/)![0]).map(link => link.text), ["Contact", "Details"]);
});

test("Download keeps the exact publisher colour in the header and drawer", async () => {
  for (const themeColor of ["#facc15", "#ffff00", "#ffffff", "#123456"]) {
    seed("en", false);
    fixtureDb.rows[0].themeColor = themeColor;
    fixtureDb.rows[0].content = { sections: [], appStoreUrl: "https://example.com/download" };
    state.open = true;
    const header = (await render("en", "site-contact")).match(/<header\b[\s\S]*?<\/header>/)![0];
    const buttons = anchors(header).filter(link => link.href === "https://example.com/download");
    assert.equal(buttons.length, 2);
    for (const button of buttons) assert.ok(button.attributes.includes(`background-color:${themeColor}`));
  }
});

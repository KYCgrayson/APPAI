import assert from "node:assert/strict";
import test from "node:test";
import { renderHtml } from "./helpers/render-html.mjs";
import { fixtureDb, registerHostedHeaders, registerHostedRenderLoader, registerHostedNavigationState } from "./helpers/hosted-render-loader.mjs";
import { normalizeRootHeaderAdditions, registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";

const loader = registerHostedRenderLoader();
const headers = registerHostedHeaders();
const state = {
  open: false, user: null as null | { id: string; name: string },
};
// Render the real drawer and links with fixture auth and initial menu state.
const hooks = registerHostedNavigationState(state);
const baseline = registerMainHostedBaseline();
// Local main still points to pre-#71; also compare the branch base byte-for-byte.
const pr71Baseline = registerMainHostedBaseline("857c588");

test.after(() => { pr71Baseline.deregister(); baseline.deregister(); hooks.deregister(); headers.deregister(); loader.deregister(); });

const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
const { default: HostedPage } = await import("../src/app/p/[...segments]/page.tsx");
const { default: NotFound } = await import("../src/app/p/[...segments]/not-found.tsx");
const { buildNav } = await import("../src/lib/site-nav.ts");
const { hostedNavigationCopy, HOME_LABELS } = await import("../src/lib/hosted-navigation-copy.ts");
const { proseThemeVariables } = await import("../src/lib/prose-theme.ts");
const { isUnavailableHostedPolicyLink } = await import("../src/lib/hosted-page-urls.ts");
const { default: MainLayout } = await import(baseline.layoutUrl);
const { default: Pr71Layout } = await import(pr71Baseline.layoutUrl);

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
    name: match[1].match(/aria-label="([^"]*)"/)?.[1] ?? match[2].replace(/<[^>]+>/g, "").trim(),
    icon: /<svg\b[^>]*width="24"[^>]*height="24"[^>]*aria-hidden="true"/.test(match[2]),
    attributes: match[1], href: match[1].match(/href="([^"]*)"/)?.[1], text: match[2].replace(/<[^>]+>/g, "").trim(),
  }));
}

function header(html: string) {
  return html.match(/<header\b[\s\S]*?<\/header>/)![0];
}

function responsiveClassSets(html: string, width: number) {
  return [...html.matchAll(/class="([^"]*)"/g)].map(match => match[1].split(/\s+/).flatMap(token => {
    const breakpoint = token.match(/^(sm|md):(.+)$/);
    if (!breakpoint) return [token];
    return width >= (breakpoint[1] === "sm" ? 640 : 768) ? [breakpoint[2]] : [];
  }));
}

test("every Home locale labels the first header control, including the open drawer and sites without logos", async () => {
  for (const [locale, label] of Object.entries(HOME_LABELS)) for (const logo of [false, true]) {
    fixtureDb.rows = [root(locale), { ...root(locale), id: "child", slug: "contact", parentSlug: "navigation-site" }];
    if (!logo) for (const row of fixtureDb.rows) row.content = { sections: [] };
    state.open = true;
    const html = header(await render(locale, "contact"));
    const links = anchors(html);
    assert.equal(links.filter(link => link.name === label).length, 1, locale);
    assert.equal(links[0].name, label, locale);
    assert.ok(links[0].attributes.includes(`title="${label}"`), locale);
    assert.equal(links[0].text, "", locale);
    assert.ok(links[0].icon, locale);
    assert.match(html, /dir="ltr" data-cramped="false"/, "Home stays physically leftmost for RTL locales");
  }
});

test("Home uses the contrast-adjusted theme colour on the white header in both page modes", async () => {
  for (const themeColor of ["#000000", "#facc15", "#ffffff", "#123456"]) for (const darkMode of [false, true]) {
    seed("en", false);
    for (const row of fixtureDb.rows) Object.assign(row, { themeColor, darkMode });
    const home = anchors(header(await render("en", "site-contact")))[0];
    assert.ok(home.attributes.includes(`color:${proseThemeVariables(themeColor)!["--page-theme-link-light"]}`));
    assert.match(home.attributes, /rounded-lg border border-gray-200 bg-gray-50/);
    assert.match(home.attributes, /hover:bg-gray-100/);
    assert.match(home.attributes, /focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2/);
  }
});

test("root headers render identically to main, including mobile and desktop class sets", async () => {
  // 32 actual render pairs: four logo/nav fixtures × two locales × auth × drawer.
  // Only AppAI links and aria-current may be removed. No class normalization.
  for (const logo of [false, true]) for (const nav of [false, true]) {
    for (const locale of ["en", "zh-TW"]) for (const signedIn of [false, true]) {
      seed(locale, nav);
      if (!logo) for (const row of fixtureDb.rows) row.content = { sections: [] };
      state.user = signedIn ? { id: "fixture-user", name: "Fixture account" } : null;
      for (const open of [false, true]) {
        state.open = open;
        const context = `${locale}, logo=${logo}, nav=${nav}, signedIn=${signedIn}, open=${open}`;
        const params = Promise.resolve({ segments: path(locale).slice(3).split("/") });
        const currentHeader = header(await renderHtml(await Layout({ params, children: null })));
        assert.equal(currentHeader, header(await renderHtml(await Pr71Layout({ params, children: null }))), `#71 main: ${context}`);
        assert.ok(!anchors(currentHeader).some(link => link.icon), "root has no Home icon");
        const actual = normalizeRootHeaderAdditions(currentHeader);
        const expected = header(await renderHtml(await MainLayout({ params, children: null })));
        assert.equal(actual, expected, context);
        for (const width of [320, 375, 399, 400, 640, 768, 1280]) {
          assert.deepEqual(responsiveClassSets(actual, width), responsiveClassSets(expected, width), `${context}, width=${width}`);
        }
      }
    }
  }
});

test("only non-root headers use px-4 mobile gutters and keep a 4px account/menu gap", async () => {
  seed("zh-TW", true);
  for (const suffix of ["site-contact", "privacy", "terms", "404"]) {
    for (const row of fixtureDb.rows) row.termsOfService = "Fixture terms text";
    const html = header(await render("zh-TW", suffix, suffix === "404"));
    assert.match(html, /class="group\/chrome [^"]*mx-auto px-4 md:px-6 [^"]*gap-0 md:gap-6/);
    assert.doesNotMatch(html, /mx-auto px-2/);
    assert.match(html, /class="flex items-center gap-1 md:gap-4 ml-auto flex-shrink-0"/);
    assert.match(html, /w-11 h-11 md:w-10 md:h-10 md:-mr-2/);
  }
  const rootHtml = header(await render("zh-TW"));
  assert.match(rootHtml, /mx-auto px-6 py-3 flex items-center gap-6/);
  assert.match(rootHtml, /flex items-center gap-3 min-w-0/);
  assert.match(rootHtml, /flex items-center gap-4 ml-auto/);
  assert.match(rootHtml, /w-10 h-10 -mr-2 rounded-md/);
});

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
        assert.equal(links[kind === "root" ? 0 : 1].href, path(locale), "publisher name still links home");
        assert.match(header, /font-semibold text-lg truncate/);
        if (kind === "root") {
          assert.equal(links.filter(link => link.name === home).length, 0, "no Home-only root nav");
        } else {
          assert.equal(links[0].name, home, "Home precedes branding");
          assert.equal(links[0].text, "", "Home has no visible text");
          assert.ok(links[0].icon, "decorative 24px inline house");
          assert.equal(links[0].href, path(locale));
          assert.doesNotMatch(links[0].attributes, /aria-current|hidden/);
          assert.match(links[0].attributes, /h-11 w-11/);
          assert.match(links[0].attributes, /focus-visible:ring-2/);
          assert.equal(header.match(/<(?:a|button)\b[^>]*>/)?.[0], `<a${links[0].attributes}>`, "Home is the first focusable element");
          assert.equal(links.filter(link => link.name === home).length, 1, "exactly one header Home, including the open drawer");
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
          assert.ok(anchors(fallback).some(link => link.name === home && link.href === path(locale)));
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

  test(`${locale}: filtering an empty policy from explicit Home/Privacy leaves no root nav`, async () => {
    for (const empty of ["", " \n\t "]) {
      seed(locale, false);
      for (const row of fixtureDb.rows) {
        row.privacyPolicy = empty;
        row.content = { sections: [], nav: [
          { label: hostedNavigationCopy(locale).home, target: path(locale) },
          { label: "Privacy", target: "privacy" },
        ] };
      }
      state.open = true;
      const header = (await render(locale)).match(/<header\b[\s\S]*?<\/header>/)![0];
      assert.doesNotMatch(header, /<nav\b/);
      assert.ok(!anchors(header).some(link => link.name === hostedNavigationCopy(locale).home));
      assert.ok(!anchors(header).some(link => link.href?.endsWith("/privacy")));

      // The root guard must preserve the leftmost Home icon on child pages.
      const child = (await render(locale, "site-contact")).match(/<header\b[\s\S]*?<\/header>/)![0];
      assert.equal(anchors(child).filter(link => link.name === hostedNavigationCopy(locale).home).length, 1);
    }
  });

  test(`${locale}: branding, Home and matching desktop/drawer links identify the current page`, async () => {
    seed(locale, true);
    state.open = true;
    for (const suffix of ["", "site-contact", "privacy"]) {
      const header = (await render(locale, suffix)).match(/<header\b[\s\S]*?<\/header>/)![0];
      const links = anchors(header);
      assert.equal(links[0].attributes.includes('aria-current="page"'), !suffix);
      const nav = header.match(/<nav\b[\s\S]*?<\/nav>/)![0];
      const currentNav = anchors(nav).filter(link => link.attributes.includes('aria-current="page"'));
      assert.deepEqual(currentNav.map(link => link.href), suffix === "privacy" ? [] : [path(locale, suffix)]);
      const current = links.filter(link => link.attributes.includes('aria-current="page"'));
      assert.ok(current.length >= 2, "both desktop and drawer identify their current destination");
      assert.ok(current.every(link => link.href === path(locale, suffix)));
      const home = links.filter(link => link.name === hostedNavigationCopy(locale).home);
      assert.ok(home.every(link => link.attributes.includes('aria-current="page"') === !suffix));
    }
  });
}

test("current-page matching handles the explicit default-locale root URL and canonical custom links", async () => {
  seed("en", true);
  fixtureDb.rows[0].content = { sections: [], nav: [
    { label: "Home", target: path("en") },
    { label: "Contact", target: "site-contact" },
    { label: "Details", target: "#details" },
    { label: "External", target: "https://example.com/p/navigation-site" },
  ] };
  state.open = true;
  const params = Promise.resolve({ segments: ["navigation-site", "en"] });
  const header = (await renderHtml(await Layout({ params, children: null }))).match(/<header\b[\s\S]*?<\/header>/)![0];
  const current = anchors(header).filter(link => link.attributes.includes('aria-current="page"'));
  assert.equal(current.length, 3, "branding, desktop Home and drawer Home");
  assert.ok(current.every(link => link.href === path("en")));
});

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
  assert.equal(links[0].href, path("zh-TW"));
  fixtureDb.rows = fixtureDb.rows.filter(row => row.parentSlug || row.locale === "en");
  links = anchors((await renderHtml(await Layout({ params, children: null }))).match(/<header\b[\s\S]*?<\/header>/)![0]);
  assert.equal(links[0].href, path("en"));
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
        assert.equal(anchors(header)[0].name, hostedNavigationCopy(locale).home);
        assert.match(header, /bg-white\/90 backdrop-blur-sm/);
        assert.match(anchors(header)[0].attributes, /color:#[a-f0-9]{6}/);
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
  assert.equal(links.filter(link => link.name === "Home").length, 1);
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

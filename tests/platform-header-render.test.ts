import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { locales } from "../src/i18n/routing.ts";
import { gameBreadcrumbs } from "../src/lib/games-page-seo.ts";
import { getDirectoryCopy } from "../src/lib/directory-copy.ts";
import { getGamesCopy } from "../src/lib/games-catalog.ts";
import { getGamePageLabels } from "../src/lib/games-pages-copy.ts";
import { renderHtml } from "./helpers/render-html.mjs";
import { fixtureDb, registerDirectoryFixtures, registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";
import { page, app } from "./fixtures/pr5-pages.ts";

const loader = registerHostedRenderLoader();
const intl = registerDirectoryFixtures({ translated: true });
const baseline = registerMainHostedBaseline("main", ["@/i18n/navigation"]);
test.after(() => { baseline.deregister(); intl.deregister(); loader.deregister(); });
const { PlatformHeaderView } = await import("../src/components/PlatformHeaderView.tsx");
const { PlatformHeader } = await import("../src/components/PlatformHeader.tsx");

function labels(locale: string) {
  const messages = JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), "utf8"));
  return {
    account: messages.common,
    categories: getDirectoryCopy(locale).categories,
    games: getGamesCopy(locale).nav,
    breadcrumb: getGamePageLabels(locale).breadcrumb,
  };
}

for (const signedIn of [true, false]) {
  test(`header with breadcrumbs reserves a mobile row and unbroken items (${signedIn ? "admin" : "signed out"}, nine locales)`, async () => {
    for (const locale of locales) {
      fixtureDb.locale = locale;
      const html = await renderHtml(PlatformHeaderView({
        breadcrumbs: gameBreadcrumbs(locale, "water-pouring"),
        user: signedIn ? { name: "Header QA Account ".repeat(20) } : null,
        isAdmin: signedIn,
        labels: labels(locale),
      }));
      const nav = html.match(/<nav\b[\s\S]*?<\/nav>/)![0];
      assert.match(nav, /order-3 min-w-0 basis-full/);
      assert.doesNotMatch(nav, /sm:(?:basis-auto|order-2)|break-words/);
      assert.match(nav, /<ol class="flex flex-wrap items-center gap-x-1.5 gap-y-1"/);
      assert.equal([...nav.matchAll(/<li class="[^"]*whitespace-nowrap"/g)].length, 3);
      assert.equal([...nav.matchAll(/<a [^>]*class="[^"]*inline-flex min-h-11 min-w-0 [^"]*items-center/g)].length, 2);
      assert.equal([...nav.matchAll(/aria-current="page"/g)].length, 1);
      assert.match(nav, /<span[^>]*aria-current="page"[^>]*class="[^"]*inline-flex min-h-11 min-w-0/);
      assert.doesNotMatch(nav, /<a[^>]*aria-current=/);
      assert.match(html, /order-2 ml-auto flex min-w-0 flex-1 items-center justify-end/);
      assert.match(html, /<select[^>]*class="[^"]*min-h-11 w-24 shrink-0 sm:w-auto/);
      if (signedIn) {
        assert.match(html, /★ Admin/);
        assert.match(html, /class="min-w-0 max-w-20 truncate text-sm sm:max-w-28 /);
        assert.match(html, /<a(?=[^>]*href="\/logout\?callbackUrl=\/")(?=[^>]*class="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap)[^>]*>/);
        assert.doesNotMatch(html, /href="\/login/);
      } else {
        assert.match(html, /href="\/login\?callbackUrl=%2Fdashboard"/);
        assert.doesNotMatch(html, /★ Admin|href="\/logout/);
      }
    }
  });
}

test("a long current breadcrumb truncates inside plain text and retains its full title", async () => {
  const name = 'Long CJK 遊戲名稱 & "name" '.repeat(20);
  const html = await renderHtml(PlatformHeaderView({
    breadcrumbs: [{ name: "AppAI", href: "/" }, { name, href: "/games/long" }],
    labels: labels("en"),
  }));
  const current = html.match(/<span[^>]*aria-current="page"[^>]*>[\s\S]*?<\/span><\/span>/)![0];
  assert.ok(current.includes(`title="${name.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`));
  assert.match(current, /min-h-11 min-w-0 max-w-full items-center/);
  assert.match(current, /<span class="truncate">/);
  assert.doesNotMatch(current, /href=|hover:/);
});

test("PlatformHeader preserves the caller's second breadcrumb label", async () => {
  fixtureDb.locale = "en";
  const html = await renderHtml(await PlatformHeader({ breadcrumbs: [
    { name: "AppAI", href: "/" }, { name: "Caller category", href: "/tools" },
    { name: "Caller page", href: "/tools/example" },
  ] }));
  assert.match(html, /<span>Caller category<\/span>/);
  assert.doesNotMatch(header(html), />Games</);
});

test("the header without breadcrumbs preserves the branding and responsive navigation classes", async () => {
  fixtureDb.locale = "en";
  const html = await renderHtml(PlatformHeaderView({ labels: labels("en"), currentSection: "tools" }));
  assert.match(html, /<span>AppAI<\/span>/);
  assert.match(html, /class="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:gap-3"/);
  assert.match(html, /class="order-3 basis-full border-t border-gray-800 pt-2 sm:order-2 sm:basis-auto sm:border-0 sm:pt-0"/);
  assert.match(html, /<a(?=[^>]*href="\/tools")(?=[^>]*aria-current="page")[^>]*>/);
  assert.doesNotMatch(html, /min-h-11 w-24/);
});

function header(html: string) {
  return html.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? "";
}

for (const [route, source] of [
  ["/apps", "src/app/[locale]/apps/page.tsx"],
  ["/websites", "src/app/[locale]/websites/page.tsx"],
  ["/tools", "src/app/[locale]/tools/page.tsx"],
  ["/apps/app-crumb", "src/app/[locale]/apps/[id]/page.tsx"],
  ["/login", "src/app/[locale]/login/page.tsx"],
  ["/games", "src/app/[locale]/games/page.tsx"],
  ["/games/water-pouring", "src/app/[locale]/games/[slug]/page.tsx"],
] as const) {
  test(`${route}: header DOM equals main except #73's current-crumb text in all nine locales`, async () => {
    const { default: CurrentPage } = await import(new URL(`../${source}`, import.meta.url).href);
    const { default: MainPage } = await import(baseline.moduleUrl(source));
    for (const locale of locales) {
      fixtureDb.locale = locale;
      fixtureDb.rows = [page("public-app", { title: "My app" })];
      fixtureDb.apps = [app("app-crumb", "public-app")];
      const props = { params: Promise.resolve({ locale, id: "app-crumb", slug: "water-pouring" }), searchParams: Promise.resolve({}) };
      const current = header(await renderHtml(await CurrentPage(props)));
      let main = header(await renderHtml(await MainPage(props)));
      if (route.startsWith("/games")) {
        // Apply only #73's final anchor-to-span change. Preserve every other
        // element, attribute, class and label from main, including the whole nav.
        const links = [...main.matchAll(/<a\b[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/g)];
        assert.equal(links.length, 1);
        const link = links[0][0];
        main = main.replace(link, link.replace(/^<a\b/, "<span").replace(/<\/a>$/, "</span>")
          .replace(/ href="[^"]*"/, "").replace(" hover:text-white hover:underline", ""));
      }
      assert.equal(current, main, `${route}, ${locale}`);
      if (route === "/login") assert.equal(current, "", "main's login has no header");
      else assert.ok(current, `${route} must retain its header`);
    }
  });
}

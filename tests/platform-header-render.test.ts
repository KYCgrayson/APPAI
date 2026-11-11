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

const loader = registerHostedRenderLoader();
const intl = registerDirectoryFixtures();
test.after(() => { intl.deregister(); loader.deregister(); });
const { PlatformHeaderView } = await import("../src/components/PlatformHeaderView.tsx");

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
      assert.match(nav, /class="order-3 min-w-0 basis-full /);
      assert.doesNotMatch(nav, /sm:(?:basis-auto|order-2)|break-words/);
      assert.match(nav, /<ol class="flex flex-wrap /);
      assert.equal([...nav.matchAll(/<li class="[^"]*whitespace-nowrap"/g)].length, 3);
      assert.equal([...nav.matchAll(/<a [^>]*class="[^"]*inline-flex min-h-11 min-w-0 [^"]*whitespace-nowrap/g)].length, 3);
      assert.equal([...nav.matchAll(/aria-current="page"/g)].length, 1);
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

test("a long current breadcrumb truncates inside the link and retains its full title", async () => {
  const name = 'Long CJK 遊戲名稱 & "name" '.repeat(20);
  const html = await renderHtml(PlatformHeaderView({
    breadcrumbs: [{ name: "AppAI", href: "/" }, { name, href: "/games/long" }],
    labels: labels("en"),
  }));
  const link = html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)![0];
  assert.ok(link.includes(`title="${name.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`));
  assert.match(link, /min-w-0 max-w-full items-center whitespace-nowrap/);
  assert.match(link, /<span class="truncate">/);
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

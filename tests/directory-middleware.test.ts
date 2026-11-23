import assert from "node:assert/strict";
import test from "node:test";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";

const loader = registerHostedRenderLoader();
test.after(() => loader.deregister());
const { NextRequest } = await import("next/server");
const { default: createIntlMiddleware } = await import("next-intl/middleware");
const { routing } = await import("../src/i18n/routing.ts");
const { middleware } = await import("../src/middleware.ts");
const { DIRECTORY_KINDS } = await import("../src/lib/directory-kind.ts");
const { UNIVERSAL_APP_CATEGORIES } = await import("../src/lib/universal-apps/manifest.ts");

const origin = "https://appai.info";
const baseline = createIntlMiddleware(routing);

test("all category and kind views rewrite to distinct, query-free ISR paths in every locale", () => {
  const paths = new Set<string>();
  for (const locale of routing.locales) {
    const prefix = locale === "en" ? "" : `/${locale}`;
    const views = DIRECTORY_KINDS.flatMap(section => UNIVERSAL_APP_CATEGORIES.flatMap(category => [
      [`/${section}?category=${category}`, `/directory-filtered/${section}/${category}`],
      ...(section === "apps" ? DIRECTORY_KINDS.map(kind => [
        `/apps?kind=${kind}&category=${category}`, `/directory-filtered/apps/${kind}-${category}`,
      ]) : []),
    ]));
    views.push(
      ["/apps?kind=apps", "/apps/native"],
      ["/apps?kind=tools", "/directory-filtered/apps/tools-ALL"],
      ["/apps?kind=websites", "/directory-filtered/apps/websites-ALL"],
      ["/websites?type=personal", "/directory-filtered/websites/personal"],
    );
    for (const [url, path] of views) {
      const request = new NextRequest(`${origin}${prefix}${url}&utm_source=tracking&fbclid=123&anything=456`, {
        headers: { "accept-language": "en" },
      });
      const response = middleware(request);
      const rewrite = response.headers.get("x-middleware-rewrite")!;
      assert.equal(rewrite, `${origin}/${locale}${path}`);
      assert.equal(response.headers.get("x-middleware-next"), null);
      assert.equal(response.headers.get("x-middleware-request-x-next-intl-locale"), locale);
      assert.equal(response.headers.get("link"), baseline(request).headers.get("link"));
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(response.headers.get("x-middleware-set-cookie"), null);
      assert.ok(!paths.has(rewrite), rewrite);
      paths.add(rewrite);
    }
  }
  assert.equal(paths.size, routing.locales.length * (6 * UNIVERSAL_APP_CATEGORIES.length + 4));
});

test("junk and unsupported filters share existing destinations; personal ignores valid categories", () => {
  const cases = [
    ["/tools?category=not-in-catalog", "/tools"],
    ["/tools?category=games", "/tools"],
    ["/tools?category=GAMES&category=OTHER", "/tools"],
    ["/tools?category=ALL", "/tools"],
    ["/tools?category=GAMES&kind=apps&type=personal", "/directory-filtered/tools/GAMES"],
    ["/tools?fbclid=unique", "/tools"],
    ["/apps?category=&kind=bad&other=unknown", "/apps"],
    ["/apps?kind=apps&kind=websites", "/apps"],
    ["/apps?category=OTHER&kind=bad", "/directory-filtered/apps/OTHER"],
    ["/apps?utm_source=tracker&category=%4fTHER&kind=apps", "/directory-filtered/apps/apps-OTHER"],
    ["/apps?kind=apps&category=ALL", "/apps/native"],
    ["/apps/native?category=OTHER&utm_medium=link", "/apps/native"],
    ["/websites?category=GAMES&type=personal", "/directory-filtered/websites/personal"],
    ["/websites?category=%2e%2e%2f&type=personal", "/websites"],
    ["/websites?type=personal&type=personal", "/websites"],
  ];
  for (const [url, path] of cases) {
    const response = middleware(new NextRequest(`${origin}/ja${url}`, {
      headers: { cookie: "NEXT_LOCALE=en" },
    }));
    assert.equal(response.headers.get("x-middleware-rewrite"), `${origin}/ja${path}`, url);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("x-middleware-set-cookie"), null);
    assert.equal(response.headers.get("x-middleware-request-x-next-intl-locale"), "ja");
  }
});

test("locale redirects take precedence over filtered directory rewrites", () => {
  for (const [source, destination] of [["/tools", "/ja/tools"], ["/en/tools", "/tools"]]) {
    const query = "?category=OTHER";
    const request = new NextRequest(`${origin}${source}${query}`, { headers: { "accept-language": "ja" } });
    const response = middleware(request);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), `${origin}${destination}${query}`);
    assert.equal(response.headers.get("x-middleware-rewrite"), null);
    assert.equal(response.headers.get("set-cookie"), baseline(request).headers.get("set-cookie"));
  }
});

test("the internal filtered route returns 404 when requested directly", () => {
  for (const prefix of ["", "/ja"]) {
    for (const path of ["/directory-filtered", "/directory-filtered/apps/GAMES", "/directory-filtered/apps/unknown"]) {
      const response = middleware(new NextRequest(`${origin}${prefix}${path}`));
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("x-middleware-rewrite"), null);
    }
  }
});

test("cookie-free visitors receive no locale cookie on cacheable public pages", () => {
  for (const locale of ["en", "ja", "zh-TW"]) {
    for (const path of ["", "/apps", "/tools", "/websites", "/apps/native"]) {
      const url = `${origin}${locale === "en" ? "" : `/${locale}`}${path}`;
      const request = new NextRequest(url, { headers: { "accept-language": "en" } });
      if (locale !== "en") assert.match(baseline(request).headers.get("set-cookie") ?? "", /^NEXT_LOCALE=/);
      const response = middleware(request);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(response.headers.get("x-middleware-rewrite"), locale === "en" ? `${origin}/en${path}` : null);
    }
  }
});

test("explicit locale cookie updates and routes outside the ISR scope retain their behavior", () => {
  const withCookie = new NextRequest(`${origin}/ja/apps`, { headers: { cookie: "NEXT_LOCALE=en" } });
  assert.match(middleware(withCookie).headers.get("set-cookie") ?? "", /^NEXT_LOCALE=ja\b/);
  for (const path of ["/ja/apps/example?category=OTHER", "/ja/games?category=OTHER", "/p/example?category=OTHER"]) {
    const request = new NextRequest(origin + path, { headers: { "accept-language": "en" } });
    const response = middleware(request);
    assert.doesNotMatch(response.headers.get("x-middleware-rewrite") ?? "", /directory-filtered/);
    if (path.startsWith("/ja/")) assert.equal(response.headers.get("set-cookie"), baseline(request).headers.get("set-cookie"));
    else assert.equal(response.headers.get("x-middleware-request-x-appai-hosted-path"), "/p/example");
  }
});

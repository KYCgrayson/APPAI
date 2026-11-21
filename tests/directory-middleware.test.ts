import assert from "node:assert/strict";
import test from "node:test";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";

const loader = registerHostedRenderLoader();
test.after(() => loader.deregister());
const { NextRequest } = await import("next/server");
const { default: createIntlMiddleware } = await import("next-intl/middleware");
const { routing } = await import("../src/i18n/routing.ts");
const { middleware } = await import("../src/middleware.ts");

const origin = "https://appai.info";
const baseline = createIntlMiddleware(routing);

test("directory rewrites preserve locale routing, query bytes and next-intl request overrides", () => {
  const query = "?kind=apps&category=A%2fb&category=B&type=personal&empty=";
  for (const [prefix, locale] of [["", "en"], ["/zh-TW", "zh-TW"], ["/ja", "ja"]]) {
    for (const directory of ["apps", "tools", "websites"]) {
      const request = new NextRequest(`${origin}${prefix}/${directory}${query}`);
      const response = middleware(request);
      assert.equal(response.headers.get("x-middleware-rewrite"), `${origin}/${locale}/directory-filtered/${directory}${query}`);
      assert.equal(response.headers.get("x-middleware-next"), null);
      assert.equal(response.headers.get("x-middleware-request-x-next-intl-locale"), locale);
      assert.equal(response.headers.get("link"), baseline(request).headers.get("link"));
    }
  }
});

test("locale redirects take precedence over filtered directory rewrites", () => {
  const query = "?category=OTHER";
  const response = middleware(new NextRequest(`${origin}/tools${query}`, { headers: { "accept-language": "ja" } }));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), `${origin}/ja/tools${query}`);
  assert.equal(response.headers.get("x-middleware-rewrite"), null);
});

test("the internal filtered route returns 404 when requested directly", () => {
  for (const prefix of ["", "/ja"]) {
    const response = middleware(new NextRequest(`${origin}${prefix}/directory-filtered/apps?kind=apps`));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-middleware-rewrite"), null);
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

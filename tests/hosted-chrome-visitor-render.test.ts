import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { visitorChromeFixture } from "./helpers/hosted-chrome-visitor.mjs";
import { stripVisitorChromeAttributes, registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";
import { fixtureDb } from "./helpers/hosted-render-loader.mjs";
import { f0Pages, f0Apps, f0Urls } from "./fixtures/pr5-pages.ts";
import { renderHtml } from "./helpers/render-html.mjs";

test("existing F0 fixture pages: all 12 full HTML renders differ from a7c1925 only by the six allowed data attributes", async () => {
  const fixture = await visitorChromeFixture();
  const baseline = registerMainHostedBaseline("a7c1925");
  try {
    const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
    const { default: Page } = await import("../src/app/p/[...segments]/page.tsx");
    const { default: BeforeLayout } = await import(baseline.layoutUrl);
    const { default: BeforePage } = await import(baseline.moduleUrl("src/app/p/[...segments]/page.tsx"));
    fixtureDb.rows = structuredClone(f0Pages);
    fixtureDb.apps = structuredClone(f0Apps);
    for (const url of f0Urls) {
      const props = { params: Promise.resolve({ segments: url.slice(3).split("/") }) };
      const html = await renderHtml(await Layout({ ...props, children: await Page(props) }));
      const before = await renderHtml(await BeforeLayout({ ...props, children: await BeforePage(props) }));
      assert.equal(stripVisitorChromeAttributes(html), before, url);
      assert.ok(html.includes('data-chrome-label="signIn"'));
    }
  } finally { baseline.deregister(); fixture.close(); }
});

test("page-locale SSR survives signed-in/out, unnamed accounts, open/closed drawer, explicit publisher nav, child/policy/404", async () => {
  const fixture = await visitorChromeFixture();
  try {
    for (const locale of ["en", "zh-TW", "ja", "xx"]) for (const suffix of ["", "visitor-child", "privacy", "terms", "missing"]) {
      for (const open of [false, true]) for (const user of [null, { name: "訪客姓名" }, {}]) {
        fixture.state.open = open;
        fixture.state.user = user;
        const options = { locale, suffix, explicitNav: true };
        const { html } = await fixture.render(options);
        const { html: before } = await fixture.render({ ...options, before: true });
        assert.equal(stripVisitorChromeAttributes(html), before, JSON.stringify({ locale, suffix, open, user }));
        assert.doesNotMatch(html, /data-chrome-label="[^"]*"[^>]*>出版者/);
        assert.doesNotMatch(html, /data-chrome-label="[^"]*"[^>]*>登入是出版者寫的導覽/);
      }
    }
  } finally { fixture.close(); }
});

test("CSP is unchanged and client chrome adds no request-dependent rendering or inline script", () => {
  const before = execFileSync("git", ["show", "a7c1925:next.config.ts"], { encoding: "utf8" });
  const csp = (text: string) => text.split("\n").filter(line => /Content-Security-Policy|-src |unsafe-|nonce/.test(line));
  assert.deepEqual(csp(readFileSync(new URL("../next.config.ts", import.meta.url), "utf8")), csp(before));
  assert.match(before, /script-src 'self'/);
  for (const path of ["src/app/p/[...segments]/VisitorChrome.tsx", "src/lib/hosted-chrome-labels.ts", "src/lib/hosted-chrome-client.ts"]) {
    const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /next\/headers|next\/cache|next-intl|from .*site-nav|from .*db|localStorage|sessionStorage|document\.cookie|<script|dangerouslySetInnerHTML/);
  }
  for (const path of ["src/app/p/[...segments]/layout.tsx", "src/app/p/[...segments]/page.tsx"]) {
    const current = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    const previous = execFileSync("git", ["show", `a7c1925:${path}`], { encoding: "utf8" });
    const sensitiveLines = (text: string) => text.split("\n").filter(line => /headers\(|cookies\(|getPlatformLocale|Vary|force-dynamic|revalidate|dynamic\s*=/.test(line));
    assert.deepEqual(sensitiveLines(current), sensitiveLines(previous));
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { renderHtml } from "./helpers/render-html.mjs";
import { fixtureDb, registerHostedRenderLoader, registerDirectoryFixtures } from "./helpers/hosted-render-loader.mjs";

const loader = registerHostedRenderLoader();
const directoryLoader = registerDirectoryFixtures();
const { PlatformDirectory } = await import("../src/components/PlatformDirectory.tsx");
const baseApp = { isApproved: true, category: "OTHER", tags: [], name: "Example app", tagline: "Example tagline", appType: null,
  logoUrl: null, iosUrl: null, androidUrl: null };
fixtureDb.apps = [
  { ...baseApp, id: "fixture-app", organizationId: "platform-org", hostedPageSlug: "example-app" },
  { ...baseApp, id: "fixture-person", organizationId: "publisher-org", hostedPageSlug: "example-person" },
];
fixtureDb.rows = [
  { slug: "example-app", organizationId: "platform-org", parentSlug: null, locale: "zh-TW", isPublished: true, isDefault: true, title: "應用網站", tagline: "實用工具", template: "APP_LANDING", content: {} },
  { slug: "example-person", organizationId: "publisher-org", parentSlug: null, locale: "zh-TW", isPublished: true, isDefault: true, title: "個人網站", tagline: "個人簡介", template: "PERSON", content: {} },
];
fixtureDb.organizations = [
  { id: "platform-org", name: "Platform organization hidden", users: [{ role: "ADMIN" }] },
  { id: "publisher-org", name: "ExampleStudio".repeat(30), users: [] },
];

test("directory renders five real tabs, publisher labels, personal profiles, Chinese fallback", async () => {
  for (const [locale, labels, prefix] of [
    ["en", ["All", "Websites", "Tools", "Apps", "Personal pages"], "By"],
    ["zh-TW", ["全部", "網站", "工具", "應用程式", "個人頁"], "發布者"],
    ["zh-CN", ["全部", "网站", "工具", "应用程序", "个人页"], "发布者"],
  ] as const) {
    fixtureDb.locale = locale;
    fixtureDb.organizationQueries = 0;
    const html = (await renderHtml(await PlatformDirectory({}))).replace(/<!--.*?-->/g, "");
    for (const label of labels) assert.match(html, new RegExp(`>${label}</a>`));
    assert.match(html, new RegExp(`${prefix} appai.info`));
    assert.match(html, /ExampleStudio/);
    assert.doesNotMatch(html, /Platform organization hidden/);
    assert.match(html, /example-person/);
    assert.match(html, /<details class=/);
    assert.equal(fixtureDb.organizationQueries, 1);
    if (locale === "zh-CN") { assert.match(html, /href="\/p\/example-app\/zh-CN"/); assert.match(html, /应用网站/); assert.match(html, /个人网站/); }
  }
});

test("personal filter ignores categories and tabs clear filters", async () => {
  fixtureDb.locale = "en";
  const html = await renderHtml(await PlatformDirectory({ kind: "websites", personalOnly: true, category: "OTHER" }));
  assert.match(html, /<a[^>]*aria-current="page"[^>]*href="\/websites\?type=personal"/);
  assert.doesNotMatch(html, /<details/);
  assert.match(html, /example-person/);
  assert.doesNotMatch(html, /href="\/p\/example-app"/);
  assert.match(html, /href="\/apps\?kind=apps"/);
});
test.after(() => { directoryLoader.deregister(); loader.deregister(); });

test("missing organizations omit publisher lines on app and personal cards", async () => {
  const saved = fixtureDb.organizations;
  try {
    fixtureDb.organizations = [];
    fixtureDb.locale = "en";
    const html = (await renderHtml(await PlatformDirectory({}))).replace(/<!--.*?-->/g, "");
    assert.match(html, /example-person/);
    assert.match(html, /example-app/);
    assert.doesNotMatch(html, />By\s*</);
  } finally { fixtureDb.organizations = saved; }
});

test("AppCard URLs retain HEAD behavior outside Chinese and select Chinese variants", async () => {
  const saved = fixtureDb.rows;
  try {
    for (const locale of ["en", "ja", "fr", "zh-CN"]) {
      fixtureDb.rows = [...saved, { ...saved[0], locale, isDefault: false, title: "Localized title" }];
      fixtureDb.locale = locale;
      const html = await renderHtml(await PlatformDirectory({}));
      assert.match(html, new RegExp(`href="/p/example-app${locale === "zh-CN" ? "/zh-CN" : ""}"`));
    }
    fixtureDb.rows = saved;
    fixtureDb.locale = "zh-TW";
    assert.match(await renderHtml(await PlatformDirectory({})), /href="\/p\/example-app"/);
  } finally { fixtureDb.rows = saved; }
});

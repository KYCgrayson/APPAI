import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { checkPagePreview } from "../src/lib/page-preview.ts";
import { createPageSchema } from "../src/lib/validations/page.ts";
import { fixtureDb, registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { registerTypographyApiFixtures } from "./helpers/typography-api-loader.mjs";
import { page } from "./fixtures/pr5-pages.ts";

const loader = registerHostedRenderLoader();
const auth = registerTypographyApiFixtures();
test.after(() => { auth.deregister(); loader.deregister(); });
Object.assign(fixtureDb.hostedPage, {
  async findUnique({ where }: { where: { slug_locale: { slug: string; locale: string } } }) {
    return fixtureDb.rows.find(row => row.slug === where.slug_locale.slug && row.locale === where.slug_locale.locale) ?? null;
  },
});
const preview = await import("../src/app/api/v1/pages/preview/route.ts");
const collection = await import("../src/app/api/v1/pages/route.ts");
const definitions = await import("../src/app/api/v1/sections/route.ts");

test("both dry-run endpoints return the actual default/nondefault locale URL, including children and upsert", async () => {
  for (const defaultLocale of ["en", "zh-TW"]) for (const locale of ["en", "zh-TW", "es"])
    for (const child of [false, true]) for (const pageDefaultLocale of child ? [defaultLocale, "ja"] : [defaultLocale]) for (const exists of [false, true]) {
      const root = page("locale-fixture", { locale: defaultLocale, organizationId: "fixture-org" });
      const payload = { slug: child ? "fixture-child" : root.slug, parentSlug: child ? root.slug : undefined, title: "Fixture", locale };
      fixtureDb.rows = [root];
      if (child) fixtureDb.rows.push(page(payload.slug, { parentSlug: root.slug, locale: pageDefaultLocale, organizationId: "fixture-org" }));
      if (exists) fixtureDb.rows.push(page(payload.slug, { ...payload, parentSlug: payload.parentSlug ?? null, organizationId: "fixture-org", isDefault: locale === pageDefaultLocale }));
      const before = JSON.stringify(fixtureDb.rows);
      const path = `/p/locale-fixture${locale === pageDefaultLocale ? "" : `/${locale}`}${child ? "/fixture-child" : ""}`;
      for (const [handler, route] of [[preview.POST, "/preview?upsert=true"], [collection.POST, "?dryRun=true&upsert=true"]] as const) {
        const response = await handler(new NextRequest(`https://example.test/api/v1/pages${route}`, { method: "POST", body: JSON.stringify(payload) }));
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.valid, true);
        assert.ok(result.next.endsWith(`https://example.test${path}`), result.next);
        assert.match(result.next, /isPublished: true/);
        if (exists || (locale === pageDefaultLocale)) assert.match(result.next, /\?upsert=true/);
      }
      assert.equal(JSON.stringify(fixtureDb.rows), before, "dry-run does not write");
    }
  fixtureDb.rows = [];
  const result = await preview.POST(new NextRequest("https://example.test/api/v1/pages/preview", { method: "POST", body: JSON.stringify({ slug: "new-site", locale: "zh-TW", title: "First locale" }) }));
  assert.ok((await result.json()).next.endsWith("/p/new-site"), "first locale becomes default even when not English");
  fixtureDb.rows = [page("new-site", { organizationId: "fixture-org" })];
  const firstChild = await preview.POST(new NextRequest("https://example.test/api/v1/pages/preview", { method: "POST", body: JSON.stringify({ slug: "new-child", parentSlug: "new-site", locale: "ja", title: "First child locale" }) }));
  assert.ok((await firstChild.json()).next.endsWith("/p/new-site/new-child"));
});

test("dry-run warns on missing or blank root privacyPolicy, while children inherit it", async () => {
  for (const privacyPolicy of [undefined, "", "   "]) {
    const payload = { slug: "privacy-fixture", title: "Fixture", privacyPolicy };
    const result = checkPagePreview(payload);
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some(w => w.path === "privacyPolicy" && /Missing privacyPolicy/.test(w.message)));
    assert.ok(!checkPagePreview({ ...payload, parentSlug: "root" }).warnings.some(w => w.path === "privacyPolicy"));
    for (const handler of [preview.POST, collection.POST]) {
      fixtureDb.rows = [];
      const response = await handler(new NextRequest("https://example.test/api/v1/pages?dryRun=true", { method: "POST", body: JSON.stringify(payload) }));
      assert.ok((await response.json()).warnings.some((w: { path: string }) => w.path === "privacyPolicy"));
    }
  }
  assert.ok(!checkPagePreview({ slug: "privacy-fixture", title: "Fixture", privacyPolicy: "The supplied policy." }).warnings.some(w => w.path === "privacyPolicy"));
});

test("placeholder store URLs warn at their exact fields without rejecting real store listings", () => {
  for (const url of ["https://apps.apple.com/app/id000000000", "https://apps.apple.com/us/app/demo/id123456789", "https://itunes.apple.com/app/id000", "https://play.google.com/store/apps/details?id=com.example.app", "https://play.google.com/store/apps/details?id=com.demo.app", "https://example.com/store"]) {
    const content = { appStoreUrl: url, sections: [{ type: "download", data: { appStoreUrl: url, playStoreUrl: url } }, { type: "hero", data: { headline: "Fixture", ctaUrl: url } }] };
    const payload = { slug: "store-fixture", title: "Fixture", content };
    const before = JSON.stringify(payload);
    const result = checkPagePreview(payload);
    assert.equal(result.valid, true);
    const warnings = result.warnings.filter(w => /Replace demo store URL/.test(w.message));
    assert.ok(warnings.some(w => w.path === "content.appStoreUrl"), url);
    assert.ok(warnings.some(w => w.path === "content.sections[0](download).data.playStoreUrl"), url);
    if (!url.includes("example.com")) assert.ok(warnings.some(w => w.path === "content.sections[1](hero).data.ctaUrl"), url);
    assert.equal(JSON.stringify(payload), before);
  }
  for (const url of ["https://apps.apple.com/us/app/notes/id987654321", "https://apps.apple.com/app/demo-maker/id123", "https://itunes.apple.com/app/id123", "https://apps.apple.com/app/example-editor/id123456789", "https://play.google.com/store/apps/details?id=com.demo.maker", "https://play.google.com/store/apps/details?id=com.studio.demoapp", "https://play.google.com/store/apps/details?id=org.studio.notes", "https://play.google.com/store/apps/details?id=com.democracy.reader", "https://example.com/real-store-redirect"]) {
    const result = checkPagePreview({ slug: "real-fixture", title: "Fixture", content: { sections: [{ type: "hero", data: { headline: "Fixture", ctaUrl: url } }] } });
    assert.ok(!result.warnings.some(w => /Replace demo store URL/.test(w.message)), url);
  }
});

test("section discovery exposes iframe-tool access in both formats and official Instagram embeds", async () => {
  const response = await definitions.GET(new NextRequest("https://example.test/api/v1/sections?type=iframe-tool,embed"));
  const { sections } = await response.json();
  const field = sections.find((s: { type: string }) => s.type === "iframe-tool").fields.find((f: { name: string }) => f.name === "access");
  assert.deepEqual(field.enum, ["login", "admin"]);
  assert.equal(field.required, false);
  const embedDescription = sections.find((s: { type: string }) => s.type === "embed").description;
  for (const provider of [/official Instagram embed iframe/, /Facebook/, /Threads/]) assert.match(embedDescription, provider);
  const schema = await (await definitions.GET(new NextRequest("https://example.test/api/v1/sections?type=iframe-tool&format=jsonschema"))).json();
  assert.deepEqual(schema.sections["iframe-tool"].properties.access.enum, ["login", "admin"]);
  assert.equal(schema.sections["iframe-tool"].properties.access.type, "string");
  assert.ok(!schema.sections["iframe-tool"].required.includes("access"));
  assert.equal(createPageSchema.parse({ slug: "draft-fixture", title: "Draft" }).isPublished, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { renderToPipeableStream } from "react-dom/server";
import { PassThrough } from "node:stream";
import { registerHostedRenderLoader, registerDirectoryFixtures, registerHostedHeaders, fixtureDb } from "./helpers/hosted-render-loader.mjs";

const hooks = registerHostedRenderLoader();
const intl = registerDirectoryFixtures({ translated: true });
const headerHooks = registerHostedHeaders();
test.after(() => { headerHooks.deregister(); intl.deregister(); hooks.deregister(); });

test("rendered /p/* pages and both layouts omit platform WebApplication and free Offer JSON-LD", async () => {
  const { default: RootLayout } = await import("../src/app/layout.tsx");
  const { default: HostedLayout } = await import("../src/app/p/[...segments]/layout.tsx");
  const { default: HostedPage } = await import("../src/app/p/[...segments]/page.tsx");
  const root = { id: "root", organizationId: "fixture-org", slug: "schema-site", parentSlug: null,
    locale: "en", title: "Hosted fixture", isDefault: true, isPublished: true, content: {},
    privacyPolicy: "Privacy", termsOfService: "Terms", createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-02-01") };
  fixtureDb.rows = [root, { ...root, slug: "schema-child", parentSlug: "schema-site" }];
  for (const suffix of [[], ["schema-child"], ["privacy"], ["terms"]]) {
    const segments = ["schema-site", "en", ...suffix];
    fixtureDb.hostedPath = `/p/${segments.join("/")}`;
    const params = Promise.resolve({ segments });
    const element = await RootLayout({ children: await HostedLayout({ params, children: await HostedPage({ params }) }) });
    const html = await new Promise<string>((resolve, reject) => {
      const output = new PassThrough();
      const chunks: string[] = [];
      output.on("data", chunk => chunks.push(chunk.toString()));
      output.on("end", () => resolve(chunks.join("")));
      output.on("error", reject);
      const rendering = renderToPipeableStream(element, { onAllReady() { rendering.pipe(output); }, onError: reject });
    });
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    assert.ok(schemas.length >= 2, "Root and hosted schemas must actually render");
    const json = JSON.stringify(schemas);
    assert.match(json, /"@type":"Organization"/);
    assert.match(json, /"@type":"WebPage"/);
    assert.doesNotMatch(json, /"@type":"WebApplication"/);
    assert.doesNotMatch(json, /"@type":"Offer"/);
    assert.doesNotMatch(json, /"@id":"https:\/\/appai.info\/#platform-app"/);
  }
});

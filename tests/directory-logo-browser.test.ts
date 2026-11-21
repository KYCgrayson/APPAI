import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fixtureDb, registerDirectoryFixtures, registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";
import { hostedChromeBrowser } from "./helpers/hosted-chrome-browser.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { app, page } from "./fixtures/pr5-pages.ts";
import { locales } from "../src/i18n/routing.ts";

test("directory cards at 375px: no page overflow, real logos and letter tiles are 48px across all locales/routes", {
  skip: process.env.DIRECTORY_LOGO_BROWSER_TESTS !== "1" ? "Opt in with DIRECTORY_LOGO_BROWSER_TESTS=1 and existing Chrome." : false,
}, async () => {
  const require = createRequire(import.meta.url);
  const cssPath = new URL("../src/app/globals.css", import.meta.url).pathname;
  const source = readFileSync(cssPath, "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../";');
  const css = (await require("postcss")([require("@tailwindcss/postcss")({ optimize: true })]).process(source, { from: cssPath })).css;
  const hooks = [registerHostedRenderLoader(), registerDirectoryFixtures({ translated: true })];
  const baseline = registerMainHostedBaseline("baa8373", ["@/i18n/navigation"]);
  let browser: Awaited<ReturnType<typeof hostedChromeBrowser>> | undefined;
  try {
    browser = await hostedChromeBrowser(process.env.HOSTED_CHROME_BINARY || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    await browser.send("Network.enable");
    await browser.send("Network.setBlockedURLs", { urls: ["http://*", "https://*"] });
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
    const { PlatformDirectory } = await import("../src/components/PlatformDirectory.tsx");
    const { PlatformDirectory: Before } = await import(baseline.moduleUrl("src/components/PlatformDirectory.tsx"));
    const { default: home } = await import("../src/app/(site)/[locale]/page.tsx");
    const logo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="12" fill="#0891b2"/><path d="M12 34L24 12L36 34Z" fill="white"/></svg>');
    const setHtml = async (html: string) => browser!.send("Page.setDocumentContent", {
      frameId: (await browser!.send("Page.getFrameTree")).frameTree.frame.id,
      // Substitute only after production URL validation/rendering, keeping this fixture fully offline.
      html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body style="margin:0;font-family:Arial">${html.replaceAll('src="/directory-fixture.svg"', `src="${logo}"`)}</body></html>`,
    });
    const screenshot = async (name: string) => {
      if (!process.env.DIRECTORY_LOGO_QA_DIR) return;
      mkdirSync(process.env.DIRECTORY_LOGO_QA_DIR, { recursive: true });
      const shot = await browser!.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(process.env.DIRECTORY_LOGO_QA_DIR, name), Buffer.from(shot.data, "base64"));
    };
    for (const locale of locales) for (const route of ["home", "all", "websites", "tools", "apps", "personal"]) {
      fixtureDb.locale = locale;
      fixtureDb.apps = [app("z-letter", "letter", { logoUrl: "#" }), app("y-logo", "logo", { logoUrl: "/directory-fixture.svg" }),
        app("x-person", "person", { logoUrl: "logo.png" }), app("w-person-logo", "person-logo", { logoUrl: "/directory-fixture.svg" })];
      fixtureDb.organizations = [];
      fixtureDb.rows = [page("letter", { title: "👩🏽‍💻 Workshop", tagline: "LongUnbrokenTagline".repeat(20), themeColor: "#fde047" }),
        page("logo", { title: "Existing logo", tagline: "LongUnbrokenTagline".repeat(20) }),
        page("person", { title: "網站".repeat(20), template: "PERSON", themeColor: "#075985" }),
        page("person-logo", { title: "Profile logo", template: "PERSON" })];
      if (route === "tools" || route === "apps") for (const row of fixtureDb.apps) row.tags = [`appai:kind:${route === "tools" ? "tool" : "app"}`];
      const props = { kind: route === "personal" ? "websites" as const : ["websites", "tools", "apps"].includes(route) ? route as "websites" | "tools" | "apps" : undefined, personalOnly: route === "personal" };
      await setHtml(await renderHtml(route === "home" ? await home({ params: Promise.resolve({ locale: fixtureDb.locale }) }) : await PlatformDirectory({ ...props, locale: fixtureDb.locale })));
      const actual = await browser.evaluate(`(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
        images: document.querySelectorAll('a[href^="/p/"] img.w-12.h-12').length,
        tiles: document.querySelectorAll('a[href^="/p/"] div.w-12.h-12').length,
        groupGaps: [...document.querySelectorAll('main > div.mt-6')].map(el => el.getBoundingClientRect().top - el.previousElementSibling.getBoundingClientRect().bottom),
        sizes: [...document.querySelectorAll('a[href^="/p/"] .w-12.h-12')].map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })) }))()`);
      assert.equal(actual.overflow, false, `${locale}/${route}`);
      assert.ok(actual.images > 0 && actual.tiles > 0, `${locale}/${route}: both valid logos and fallback tiles render`);
      for (const gap of actual.groupGaps) assert.ok(gap >= 24, `${locale}/${route}: logo groups need spacing`);
      assert.ok(actual.sizes.length >= 2, `${locale}/${route}`);
      for (const size of actual.sizes) assert.deepEqual(size, { width: 48, height: 48 }, `${locale}/${route}`);
      if (locale === "en" && route === "websites") {
        await screenshot("directory-after-375.png");
        await setHtml(await renderHtml(await Before(props)));
        await screenshot("directory-before-375.png");
      }
    }
  } finally {
    if (browser) await browser.close();
    baseline.deregister(); hooks.reverse().forEach(h => h.deregister());
  }
});

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { renderHtml } from "./helpers/render-html.mjs";
import { fixtureDb, registerHostedRenderLoader, registerHostedNavigationState } from "./helpers/hosted-render-loader.mjs";
import { hostedChromeBrowser } from "./helpers/hosted-chrome-browser.mjs";
import { page } from "./fixtures/pr5-pages.ts";

const binary = process.env.HOSTED_CHROME_BINARY || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
test("desktop and mobile headers contain exactly one visible Home, with the drawer closed or open", {
  skip: process.env.HOSTED_NAV_BROWSER_TESTS !== "1" ? "Opt in with HOSTED_NAV_BROWSER_TESTS=1 and an existing Chrome installation." : false,
}, async () => {
  assert.ok(existsSync(binary), "Set HOSTED_CHROME_BINARY to an existing Chrome executable");
  const require = createRequire(import.meta.url);
  const cssPath = new URL("../src/app/globals.css", import.meta.url).pathname;
  const cssSource = readFileSync(cssPath, "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../";');
  const css = (await require("postcss")([require("@tailwindcss/postcss")({ optimize: true })])
    .process(cssSource, { from: cssPath })).css;
  const loader = registerHostedRenderLoader();
  const state = { open: false, user: null as null | { name: string } };
  const hooks = registerHostedNavigationState(state);
  const browser = await hostedChromeBrowser(binary);
  try {
    const { default: Layout } = await import("../src/app/p/[...segments]/layout.tsx");
    for (const locale of ["en", "zh-TW", "de", "es", "fr"]) {
      const root = page("browser-site", { locale, title: "A long publisher 網站名稱",
        content: { logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E", sections: [] } });
      fixtureDb.rows = [root, { ...root, id: "child", slug: "contact", parentSlug: root.slug, title: "Contact" }];
      for (const signedIn of [false, true]) {
        state.user = signedIn ? { name: "Long signed-in account name ".repeat(10) } : null;
        for (const open of [false, true]) {
          state.open = open;
          const html = await renderHtml(await Layout({ params: Promise.resolve({ segments: [root.slug, "contact"] }), children: null }));
          for (const width of [320, 375, 399, 400, 640, 768, 1280]) {
            const context = `${locale}, signedIn=${signedIn}, open=${open}, width=${width}`;
            await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
            await browser.send("Page.setDocumentContent", { frameId: (await browser.send("Page.getFrameTree")).frameTree.frame.id,
              html: `<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>` });
            // At 768px, also exercise the CSS state selected by AdaptiveChrome
            // when the inline desktop controls do not fit.
            if (width === 768) await browser.evaluate("document.querySelector('header').firstElementChild.dataset.cramped = 'true'");
            const result = await browser.evaluate(`(() => {
              const header = document.querySelector('header');
              const visible = el => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
              const links = [...header.querySelectorAll('a')];
              const home = links.filter(el => ['Home', '首頁', 'Startseite', 'Inicio', 'Accueil'].includes(el.textContent.trim()));
              const row = header.firstElementChild;
              const account = [...row.lastElementChild.querySelectorAll('a[href^="/login"], a[aria-label], a[href^="/logout"]')].find(visible);
              const rect = account?.getBoundingClientRect();
              const title = row.querySelector('a > span.truncate').getBoundingClientRect();
              const menu = row.querySelector('button[aria-expanded]').getBoundingClientRect();
              const accountGroup = [...row.lastElementChild.children].filter(visible).at(-2).getBoundingClientRect();
              return { homeCount: home.length, visibleHomes: home.filter(visible).length,
                accountVisible: visible(account) && rect.left >= 0 && rect.right <= innerWidth,
                accountWidth: rect.width, accountHeight: rect.height, titleWidth: title.width,
                gutter: parseFloat(getComputedStyle(row).paddingLeft),
                accountMenuGap: menu.left - accountGroup.right,
                overflow: row.scrollWidth > row.clientWidth, siblings: links.filter(el => el.textContent === 'Contact').length };
            })()`);
            assert.equal(result.homeCount, 1, context);
            assert.equal(result.visibleHomes, 1, context);
            assert.equal(result.accountVisible, true, context);
            if (width < 400) {
              assert.ok(result.accountWidth >= 44 && result.accountHeight >= 44, context);
              if (locale === "zh-TW" && width === 375) {
                assert.ok(result.titleWidth >= 170, `${context}, titleWidth=${result.titleWidth}`);
              }
            } else if (!signedIn) assert.equal(result.accountHeight, 36, context);
            if (width < 768) {
              assert.equal(result.overflow, false, context);
              assert.equal(result.gutter, 16, context);
              assert.ok(result.accountMenuGap >= 4, `${context}, accountMenuGap=${result.accountMenuGap}`);
            }
            assert.equal(result.siblings, open ? 2 : 1, context);
          }
        }
      }
    }
  } finally { await browser.close(); hooks.deregister(); loader.deregister(); }
});

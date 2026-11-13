import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { renderHtml } from "./helpers/render-html.mjs";
import { fixtureDb, registerHostedRenderLoader, registerHostedNavigationState } from "./helpers/hosted-render-loader.mjs";
import { hostedChromeBrowser } from "./helpers/hosted-chrome-browser.mjs";
import { hostedNavigationCopy } from "../src/lib/hosted-navigation-copy.ts";
import { page } from "./fixtures/pr5-pages.ts";

const binary = process.env.HOSTED_CHROME_BINARY || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
test("desktop and mobile headers contain exactly one visible Home, with the drawer closed or open", {
  skip: process.env.HOSTED_NAV_BROWSER_TESTS !== "1" ? "Opt in with HOSTED_NAV_BROWSER_TESTS=1 and an existing Chrome installation." : false,
}, async (t) => {
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
    for (const locale of ["en", "zh-TW", "zh-CN", "de", "es", "fr", "ar"]) for (const logo of [false, true]) {
      const root = page("browser-site", { locale, title: "這是一個很長的繁體中文網站名稱與作品集",
        content: { logo: logo ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" : undefined, sections: [] } });
      fixtureDb.rows = [root, { ...root, id: "child", slug: "contact", parentSlug: root.slug, title: "Contact" }];
      for (const signedIn of [false, true]) {
        state.user = signedIn ? { name: "Long signed-in account name ".repeat(10) } : null;
        for (const open of [false, true]) for (const suffix of ["contact", "privacy", "terms", "missing-child"]) {
          state.open = open;
          const html = await renderHtml(await Layout({ params: Promise.resolve({ segments: [root.slug, suffix] }), children: null }));
          for (const width of [320, 375, 399, 400, 640, 768, 1280]) {
            const context = `${locale}, logo=${logo}, suffix=${suffix}, signedIn=${signedIn}, open=${open}, width=${width}`;
            await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
            await browser.send("Page.setDocumentContent", { frameId: (await browser.send("Page.getFrameTree")).frameTree.frame.id,
              html: `<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>` });
            // SSR fixtures do not hydrate. Apply AdaptiveChrome's overflow
            // decision, and also exercise its cramped state at 768px.
            await browser.evaluate(`(() => {
              const row = document.querySelector('header').firstElementChild;
              row.dataset.cramped = String(row.scrollWidth > row.clientWidth + 2 || innerWidth === 768);
            })()`);
            const result = await browser.evaluate(`(() => {
              const header = document.querySelector('header');
              const visible = el => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
              const links = [...header.querySelectorAll('a')];
              const home = links.filter(el => (el.getAttribute('aria-label') || el.textContent.trim()) === ${JSON.stringify(hostedNavigationCopy(locale).home)});
              const row = header.firstElementChild;
              const account = [...row.lastElementChild.querySelectorAll('a[href^="/login"], a[aria-label], a[href^="/logout"]')].find(visible);
              const rect = account?.getBoundingClientRect();
              const title = row.querySelector('a > span.truncate').getBoundingClientRect();
              const menu = row.querySelector('button[aria-expanded]').getBoundingClientRect();
              const accountGroup = [...row.lastElementChild.children].filter(visible).at(-2).getBoundingClientRect();
              const homeRect = home[0].getBoundingClientRect();
              const svg = home[0].querySelector('svg');
              home[0].focus();
              return { firstFocusableIsHome: header.querySelector('a[href], button, input, [tabindex="0"]') === home[0],
                homeIsFirstElement: row.firstElementChild.firstElementChild === home[0],
                homeWidth: homeRect.width, homeHeight: homeRect.height,
                homeLeft: homeRect.left, expectedLeft: row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).paddingLeft),
                decorativeIcon: svg?.getAttribute('aria-hidden') === 'true' && svg.getBoundingClientRect().width === 24,
                noHomeText: home[0].textContent.trim() === '', titleMatchesLabel: home[0].title === home[0].getAttribute('aria-label'),
                focusRing: getComputedStyle(home[0]).boxShadow !== 'none',
                homeCount: home.length, visibleHomes: home.filter(visible).length,
                accountVisible: visible(account) && rect.left >= 0 && rect.right <= innerWidth,
                accountWidth: rect.width, accountHeight: rect.height, titleWidth: title.width,
                gutter: parseFloat(getComputedStyle(row).paddingLeft),
                accountMenuGap: menu.left - accountGroup.right,
                overflow: row.scrollWidth > row.clientWidth, siblings: links.filter(el => el.textContent === 'Contact').length };
            })()`);
            assert.equal(result.homeCount, 1, context);
            assert.equal(result.visibleHomes, 1, context);
            assert.equal(result.firstFocusableIsHome, true, context);
            assert.equal(result.homeIsFirstElement, true, context);
            assert.equal(result.homeLeft, result.expectedLeft, context);
            assert.equal(result.homeWidth, 44, context);
            assert.equal(result.homeHeight, 44, context);
            assert.equal(result.decorativeIcon, true, context);
            assert.equal(result.noHomeText, true, context);
            assert.equal(result.titleMatchesLabel, true, context);
            assert.equal(result.focusRing, true, context);
            assert.equal(result.accountVisible, true, context);
            if (width < 400) {
              assert.ok(result.accountWidth >= 44 && result.accountHeight >= 44, context);
              if (locale === "zh-TW" && [320, 375].includes(width)) {
                assert.equal(Math.round(result.titleWidth), width - (logo ? 204 : 168), context);
                if (!signedIn && !open && suffix === "contact") t.diagnostic(`zh-TW title at ${width}px, logo=${logo}: ${result.titleWidth}px`);
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

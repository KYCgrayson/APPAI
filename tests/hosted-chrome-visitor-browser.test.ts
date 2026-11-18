import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostedChromeBrowser } from "./helpers/hosted-chrome-browser.mjs";
import { visitorChromeFixture, visitorChromeBrowserBundle } from "./helpers/hosted-chrome-visitor.mjs";

test("visitor chrome: actual hydration, browser locales, late drawer, publisher/SEO/link preservation and muted screenshots", {
  skip: process.env.HOSTED_CHROME_LOCALE_BROWSER_TESTS !== "1" ? "Opt in with HOSTED_CHROME_LOCALE_BROWSER_TESTS=1 and existing Chrome." : false,
}, async () => {
  const fixture = await visitorChromeFixture();
  let browser: Awaited<ReturnType<typeof hostedChromeBrowser>> | undefined;
  try {
    const { html, menuProps } = await fixture.render({ suffix: "visitor-child", explicitNav: true });
    const script = visitorChromeBrowserBundle(menuProps);
    const require = createRequire(import.meta.url);
    const path = new URL("../src/app/globals.css", import.meta.url).pathname;
    const source = readFileSync(path, "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../";');
    const css = (await require("postcss")([require("@tailwindcss/postcss")({ optimize: true })]).process(source, { from: path })).css;
    const document = `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'"><style>${css}</style></head><body>${html}</body></html>`;
    const dir = process.env.HOSTED_CHROME_LOCALE_QA_DIR;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/before.html`, document);
      writeFileSync(`${dir}/after.html`, document.replace('</body>', `<script>${script.replaceAll('</script', '<\\/script')}</script></body>`));
    }
    browser = await hostedChromeBrowser(process.env.HOSTED_CHROME_BINARY || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    await browser.send("Network.enable");
    await browser.send("Network.setBlockedURLs", { urls: ["http://*", "https://*"] });
    const capture = `(() => ({ content: document.querySelector('main > [data-dark]').outerHTML,
      publisher: [...document.querySelectorAll('[data-breadcrumb] [title]')].filter(el => !el.hasAttribute('data-chrome-title')).map(el => [el.textContent, el.title]),
      seo: [...document.querySelectorAll('script[type="application/ld+json"]')].map(el => el.textContent),
      links: [...document.querySelectorAll('a')].map(el => el.getAttribute('href')),
      icons: document.querySelectorAll('svg,img').length, htmlLang: document.documentElement.lang }))()`;
    for (const width of [375, 1440]) for (const locale of ["en-US", "zh-TW", "xx"]) {
      await browser.send("Network.setUserAgentOverride", { userAgent: "AppAI fixture browser", acceptLanguage: locale });
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const frameId = (await browser.send("Page.getFrameTree")).frameTree.frame.id;
      await browser.send("Page.setDocumentContent", { frameId, html: document });
      assert.equal(await browser.evaluate("navigator.languages[0]"), locale);
      const original = await browser.evaluate(capture);
      const originalScope = await browser.evaluate("document.querySelector('[data-chrome-locale]').outerHTML");
      assert.equal(await browser.evaluate("document.querySelector('[data-chrome-label=signIn]').textContent"), "登入");
      if (dir && locale === "en-US") {
        const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        writeFileSync(`${dir}/before-${width}.png`, Buffer.from(shot.data, "base64"));
      }
      await browser.evaluate(script);
      await browser.evaluate("new Promise(resolve => setTimeout(resolve, 150))");
      const english = locale === "en-US";
      const result = await browser.evaluate(`(() => ({ signIn: document.querySelector('[data-chrome-label=signIn]').textContent,
        privacy: document.querySelector('[data-chrome-label=privacy]').textContent,
        terms: document.querySelector('[data-chrome-label=terms]').textContent,
        home: document.querySelector('[data-chrome-title=home]').title,
        homeAria: document.querySelector('[data-chrome-title=home]').getAttribute('aria-label'),
        official: document.querySelector('[data-chrome-title=officialSite]').title,
        swapped: [...document.querySelectorAll('[data-chrome-label],[data-chrome-aria-label],[data-chrome-title]')].map(el => el.lang),
        contentLanguage: document.querySelector('[data-breadcrumb] [aria-current=page]').closest('[lang]').lang,
        errors: window.chromeErrors }))()`);
      assert.equal(result.signIn, english ? "Sign in" : "登入");
      assert.equal(result.privacy, english ? "Privacy" : "隱私");
      assert.equal(result.terms, english ? "Terms" : "條款");
      assert.equal(result.home, english ? "Home" : "首頁");
      assert.equal(result.homeAria, result.home);
      assert.equal(result.official, `${english ? "Official site" : "官方網站"}: example.com`);
      assert.ok(result.swapped.every((lang: string) => lang === (english ? "en" : "")));
      assert.equal(result.contentLanguage, "zh-TW");
      assert.deepEqual(result.errors, []);
      assert.deepEqual(await browser.evaluate(capture), original);
      if (!english) assert.equal(await browser.evaluate("document.querySelector('[data-chrome-locale]').outerHTML"), originalScope);
      if (dir && english) {
        const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        writeFileSync(`${dir}/after-${width}.png`, Buffer.from(shot.data, "base64"));
      }
      // Only operate the menu button; no media playback or link navigation.
      await browser.evaluate("document.querySelector('button[data-chrome-aria-label=openMenu]').click()");
      await browser.evaluate("new Promise(resolve => setTimeout(resolve, 100))");
      assert.equal(await browser.evaluate("document.querySelector('button[aria-expanded]').getAttribute('aria-label')"), english ? "Close menu" : "關閉選單");
      assert.ok((await browser.evaluate("[...document.querySelectorAll('[data-chrome-label=signIn]')].map(el => el.textContent)")).every((text: string) => text === (english ? "Sign in" : "登入")));
      assert.equal(await browser.evaluate("[...document.querySelectorAll('a')].find(el => el.textContent === '登入是出版者寫的導覽').textContent"), "登入是出版者寫的導覽");
      await browser.evaluate("document.querySelector('button[aria-expanded]').click()");
      await browser.evaluate("new Promise(resolve => setTimeout(resolve, 100))");
      assert.deepEqual(await browser.evaluate("window.chromeErrors"), []);
      assert.deepEqual(await browser.evaluate(capture), original);
      await browser.evaluate("window.visitorRoot.unmount()");
    }
  } finally { await browser?.close(); fixture.close(); }
});

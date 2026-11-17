import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { PAGE_STYLES } from "../src/lib/page-styles.ts";
import { readableTextColor, hostedChromeTheme } from "../src/lib/prose-theme.ts";
import { darkStyleRenderer } from "./helpers/dark-style-render.mjs";
import { hostedChromeBrowser } from "./helpers/hosted-chrome-browser.mjs";

function contrast(a: string, b: string) {
  const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(part => parseInt(part, 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

test("light hosted HTML is byte-identical to 027beea across all five light kits and chrome states", async () => {
  const baseline = JSON.parse(readFileSync(new URL("./fixtures/dark-style-light-baseline.json", import.meta.url), "utf8"));
  const renderer = await darkStyleRenderer();
  try {
    let count = 0;
    for (const kit of PAGE_STYLES.filter(k => !k.darkMode)) for (const mode of ["omitted", false])
      for (const child of [false, true]) for (const open of [false, true]) for (const signedIn of [false, true]) {
        const key = JSON.stringify([kit.id, mode, child, open, signedIn]);
        const html = await renderer.render(kit, { mode, child, open, signedIn });
        assert.equal(createHash("sha256").update(html).digest("hex"), baseline.hashes[key], key);
        count++;
      }
    assert.equal(count, 80);
  } finally { renderer.close(); }
});

test("dark-kit about body and automatic CTA foregrounds meet AA, including Markdown and buttons", async () => {
  const renderer = await darkStyleRenderer();
  try {
    for (const kit of PAGE_STYLES.filter(k => k.darkMode)) {
      const html = await renderer.render(kit);
      assert.match(html, /leading-relaxed text-gray-300/);
      for (const bg of [...kit.backgroundColors, "#111827", "#1f2937"]) assert.ok(contrast("#d1d5db", bg) >= 4.5);
      const foreground = readableTextColor(kit.themeColor);
      assert.ok(contrast(foreground, kit.themeColor) >= 4.5);
      assert.ok(html.includes(`background-color:${kit.themeColor};color:${foreground}`));
      assert.ok(html.includes(`color:${kit.themeColor};background-color:${foreground}`));
      assert.match(html, /prose-inherit-color/);
      assert.doesNotMatch(html, /text-white\/80/);
      assert.match(html, /data-hosted-dark="true"/);
    }
  } finally { renderer.close(); }
  // Exercise light and dark brand colours, including the decision boundary.
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const bg = `#${[r, g, b].map(c => c.toString(16).padStart(2, "0")).join("")}`;
    assert.ok(contrast(readableTextColor(bg), bg) >= 4.5, bg);
  }
});

test("chrome follows the displayed child or light policy without changing their content", async () => {
  const renderer = await darkStyleRenderer();
  const kit = PAGE_STYLES.find(k => k.id === "midnight")!;
  const main = (html: string) => html.match(/<main\b[\s\S]*?<\/main>/)![0];
  try {
    for (const policy of ["privacy", "terms"]) {
      assert.doesNotMatch(await renderer.render(kit, { mode: true, policy }), /data-hosted-dark/);
      assert.equal(main(await renderer.render(kit, { mode: true, policy })), main(await renderer.render(kit, { mode: false, policy })));
    }
    for (const childMode of ["omitted", false]) {
      assert.doesNotMatch(await renderer.render(kit, { mode: true, child: true, childMode }), /data-hosted-dark/);
      assert.equal(main(await renderer.render(kit, { mode: true, child: true, childMode })), main(await renderer.render(kit, { mode: false, child: true, childMode })));
    }
    assert.match(await renderer.render(kit, { mode: false, child: true, childMode: true }), /data-hosted-dark="true"/);
    // Every chrome rule stays outside main, where policy/child modes are independent.
    const require = createRequire(import.meta.url);
    const css = require("postcss").parse(readFileSync(new URL("../src/templates/shared/hosted-chrome.css", import.meta.url), "utf8"));
    css.walkRules((rule: { selector: string }) => assert.ok(rule.selector.startsWith('[data-hosted-dark="true"] > :is(header, footer)'), rule.selector));
  } finally { renderer.close(); }
});

test("complete root and child routes share their own dark surfaces with the breadcrumb and flex wrapper", async () => {
  const renderer = await darkStyleRenderer();
  try {
    for (const kit of PAGE_STYLES.filter(k => k.darkMode)) {
      const childKit = PAGE_STYLES.find(k => k.darkMode && k.id !== kit.id)!;
      for (const child of [false, true]) {
        const html = await renderer.render(kit, { short: true, child, childKit, actualRoute: true });
        assert.match(html, /data-breadcrumb="hosted"/);
        assert.match(html, /background-color:var\(--hosted-chrome-bg, #111827\)/);
        assert.ok(html.includes(`--hosted-chrome-bg:${(child ? childKit : kit).backgroundColors[0]}`));
        assert.match(html, /<main class="flex-1">/);
      }
      const light = await renderer.render(kit, { short: true, child: true, childMode: false, childKit: PAGE_STYLES[0], actualRoute: true });
      assert.doesNotMatch(light, /data-hosted-dark|--hosted-chrome-bg/);
      assert.match(light, /data-breadcrumb="hosted" style="background-color:#ffffff/);
    }
  } finally { renderer.close(); }
});

test("dark chrome selects safe page surfaces and logo priority; light headers retain headerLogo", async () => {
  const renderer = await darkStyleRenderer();
  const kit = PAGE_STYLES.find(k => k.id === "ember")!;
  try {
    const header = (html: string) => html.match(/<header\b[\s\S]*?<\/header>/)![0];
    for (const mode of [true, false]) for (const rootLogo of ["/primary.png", ""]) for (const heroLogo of ["/hero.png", ""]) {
      const html = header(await renderer.render(kit, { mode, rootLogo, heroLogo, headerLogo: "/header.png", heroImage: "/image.png" }));
      const expected = mode ? rootLogo || heroLogo || "/header.png" : "/header.png";
      assert.ok(html.includes(`src="${expected}"`), expected);
    }
    const mixed = header(await renderer.render(kit, { mode: true, child: true, childMode: false, headerLogo: "/header.png" }));
    assert.ok(mixed.includes('src="/header.png"'));
    const darkChild = header(await renderer.render(kit, { mode: false, child: true, childMode: true, rootLogo: "/primary.png", headerLogo: "/header.png" }));
    assert.ok(darkChild.includes('src="/primary.png"'));
  } finally { renderer.close(); }
  for (const backgrounds of [["#ffffff", "#1C1917", "#292524"], ["red", "url(x)", "#abc"], ["#595959"], []]) {
    const theme = hostedChromeTheme(backgrounds.map((backgroundColor, order) => ({ order, data: { backgroundColor } })));
    for (const bg of [theme.backgroundColor, theme["--hosted-chrome-surface"]]) assert.ok(contrast("#d1d5db", bg) >= 4.5);
    if (backgrounds.includes("#1C1917")) assert.equal(theme.backgroundColor, "#1C1917");
  }
});

test("dark chrome and CTA computed contrast; DEMO ribbon clears the logo on desktop and mobile", {
  skip: process.env.DARK_STYLE_BROWSER_TESTS !== "1" ? "Opt in with DARK_STYLE_BROWSER_TESTS=1 and existing Chrome." : false,
}, async (t) => {
  const require = createRequire(import.meta.url);
  const cssPath = new URL("../src/app/globals.css", import.meta.url).pathname;
  const cssSource = readFileSync(cssPath, "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../";');
  const baseCss = (await require("postcss")([require("@tailwindcss/postcss")({ optimize: true })]).process(cssSource, { from: cssPath })).css;
  const chromeCss = readFileSync(new URL("../src/templates/shared/hosted-chrome.css", import.meta.url), "utf8");
  const logo = "data:image/png;base64," + readFileSync(new URL("../public/appai-logo2.png", import.meta.url)).toString("base64");
  const renderer = await darkStyleRenderer();
  const browser = await hostedChromeBrowser(process.env.HOSTED_CHROME_BINARY || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  const qaDir = process.env.DARK_STYLE_QA_DIR;
  if (qaDir) mkdirSync(qaDir, { recursive: true });
  try {
    for (const kit of PAGE_STYLES.filter(k => k.darkMode)) for (const width of [375, 1280]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      const documentHtml = (html: string, styles = chromeCss) => `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${baseCss}${styles}</style></head><body>${html.replaceAll('/appai-logo2.png', logo)}</body></html>`;
      const setHtml = async (html: string, styles = chromeCss) => browser.send("Page.setDocumentContent", {
        frameId: (await browser.send("Page.getFrameTree")).frameTree.frame.id,
        html: documentHtml(html, styles),
      });
      const screenshot = async (name: string) => {
        if (!qaDir) return;
        const { cssContentSize: size } = await browser.send("Page.getLayoutMetrics");
        const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: size.height, scale: 1 } });
        writeFileSync(`${qaDir}/${kit.id}-${width}-${name}.png`, Buffer.from(shot.data, "base64"));
      };
      if (qaDir && existsSync(`${qaDir}/${kit.id}-before.html`)) {
        await setHtml(readFileSync(`${qaDir}/${kit.id}-before.html`, "utf8"), readFileSync(`${qaDir}/round2-before-chrome.css`, "utf8"));
        await screenshot("before");
      }
      const longHtml = await renderer.render(kit, { demo: true, actualRoute: true });
      if (qaDir) writeFileSync(`${qaDir}/${kit.id}-after.html`, documentHtml(longHtml));
      await setHtml(longHtml);
      const result = await browser.evaluate(`(() => {
        const ctx = document.createElement('canvas').getContext('2d');
        const hex = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return '#' + [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(c => c.toString(16).padStart(2, '0')).join(''); };
        const bg = el => { while (el) { const value = getComputedStyle(el).backgroundColor; if (value !== 'rgba(0, 0, 0, 0)') return hex(value); el = el.parentElement; } return '#ffffff'; };
        const targets = [...document.querySelectorAll('main .prose p, main .prose a, main .prose strong, main .prose h3, main h2, main section > div > a, header a, header button:not(.fixed), header span, footer a, footer p')].filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height);
        const logo = document.querySelector('header img').getBoundingClientRect();
        const ribbon = [...document.querySelectorAll('.fixed')].find(el => el.textContent.trim() === 'Demo').getBoundingClientRect();
        return { header: bg(document.querySelector('header')), footer: bg(document.querySelector('footer')),
          clear: ribbon.top >= logo.bottom || ribbon.right <= logo.left || ribbon.left >= logo.right,
          pairs: targets.map(el => [el.textContent.trim(), hex(getComputedStyle(el).color), bg(el)]) };
      })()`);
      assert.equal(result.header, kit.backgroundColors[0].toLowerCase());
      assert.equal(result.footer, kit.backgroundColors[0].toLowerCase());
      assert.equal(result.clear, true);
      for (const [label, fg, bg] of result.pairs) assert.ok(contrast(fg, bg) >= 4.5, `${kit.id}/${width} ${label}: ${fg} on ${bg}`);
      await screenshot("after");
      await setHtml(await renderer.render(kit, { child: true, open: true, signedIn: true, childLocales: true, actualRoute: true }));
      const drawer = await browser.evaluate(`(() => {
        const el = document.querySelector('header div.fixed');
        const home = document.querySelector('header a[aria-label="Home"]');
        return { background: getComputedStyle(el).backgroundColor, home: home.style.color, account: getComputedStyle(document.querySelector('header span[title="Fixture visitor"]')).color };
      })()`);
      assert.equal(drawer.background, `rgb(${kit.backgroundColors[1].slice(1).match(/../g)!.map(c => parseInt(c, 16)).join(", ")})`);
      assert.equal(drawer.account, "rgb(209, 213, 219)");
      const chromePairs = await browser.evaluate(`(() => {
        const ctx = document.createElement('canvas').getContext('2d');
        const rgb = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return '#' + [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(c => c.toString(16).padStart(2, '0')).join(''); };
        const bg = el => { while(el) { const c = getComputedStyle(el).backgroundColor; if(c !== 'rgba(0, 0, 0, 0)') return rgb(c); el = el.parentElement; } return '#ffffff'; };
        const active = document.querySelector('header div.fixed a.bg-gray-900');
        return { active: [bg(active), bg(active.parentElement)], pairs: [...document.querySelectorAll('header a, header button:not(.fixed), header span, footer a, footer p')]
          .filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height)
          .map(el => [el.textContent.trim() || el.getAttribute('aria-label'), rgb(getComputedStyle(el).color), bg(el)]) };
      })()`);
      assert.ok(contrast(...chromePairs.active as [string, string]) >= 3, "active pill is distinct from drawer");
      for (const [label, fg, bg] of chromePairs.pairs) assert.ok(contrast(fg, bg) >= 4.5, `drawer ${kit.id}/${width} ${label}: ${fg} on ${bg}`);
      await screenshot("drawer");
      // Short page has a real flex-grown gap; sample backgrounds across its full height.
      for (const scenario of ["short", "light-child", "dark-child", "privacy", "terms"] as const) {
        const lightKit = PAGE_STYLES[0];
        const options = scenario === "short" ? { short: true }
          : scenario === "light-child" ? { short: true, child: true, childMode: false, childKit: lightKit }
          : scenario === "dark-child" ? { short: true, mode: false, child: true, childMode: true, childKit: kit }
          : { policy: scenario };
        if (qaDir && existsSync(`${qaDir}/${kit.id}-${scenario}-before.html`)) {
          await setHtml(readFileSync(`${qaDir}/${kit.id}-${scenario}-before.html`, "utf8"), readFileSync(`${qaDir}/round2-before-chrome.css`, "utf8"));
          await screenshot(`${scenario}-before`);
        }
        const html = await renderer.render(kit, { ...options, actualRoute: true });
        if (qaDir) writeFileSync(`${qaDir}/${kit.id}-${scenario}-after.html`, documentHtml(html));
        await setHtml(html);
        const surface = await browser.evaluate(`(() => {
          const ctx = document.createElement('canvas').getContext('2d');
          const hex = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return '#' + [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(c => c.toString(16).padStart(2, '0')).join(''); };
          const bg = el => { while(el) { const c = getComputedStyle(el).backgroundColor; if(c !== 'rgba(0, 0, 0, 0)') return hex(c); el = el.parentElement; } return '#ffffff'; };
          const main = document.querySelector('main');
          const content = main.lastElementChild.getBoundingClientRect();
          return { header: bg(document.querySelector('header')), footer: bg(document.querySelector('footer')),
            gap: main.getBoundingClientRect().bottom - content.bottom,
            samples: Array.from({length: innerHeight}, (_, y) => bg(document.elementFromPoint(1, y))) };
        })()`);
        const dark = scenario === "short" || scenario === "dark-child";
        const expected = dark ? kit.backgroundColors[0].toLowerCase() : "#ffffff";
        assert.equal(surface.footer, expected, scenario);
        assert.equal(surface.header, expected, scenario);
        if (dark) {
          assert.ok(surface.gap > 100, `${scenario}: fixture must expose the flex gap`);
          assert.ok(surface.samples.every((bg: string) => bg === expected), `${scenario}: entire page edge stays dark`);
        }
        await screenshot(`${scenario}-after`);
      }
      if (qaDir) {
        const rows = ["", "short-", "light-child-"].map(prefix => `<section><h2>${prefix || "Full page"}</h2><div class="pair">${["before", "after"].map(stage => `<figure><figcaption>${stage}</figcaption><img src="${kit.id}-${width}-${prefix}${stage}.png"></figure>`).join("")}</div></section>`).join("");
        writeFileSync(`${qaDir}/${kit.id}-${width}-comparison.html`, `<!doctype html><html><head><meta charset="utf-8"><title>${kit.id} ${width}px round 2</title><style>body{font:16px system-ui;background:#eee;margin:24px}.pair{display:flex;gap:16px}figure{margin:0;flex:1;min-width:0}img{width:100%;max-width:${width}px;border:1px solid #aaa}figcaption{padding:8px}</style></head><body><h1>${kit.id} · ${width}px · round 2 (78eee45 → working tree)</h1>${rows}</body></html>`);
      }
      t.diagnostic(`${kit.id} ${width}px: ${result.pairs.length} computed contrast checks; logo clear; dark drawer/account.`);
    }
  } finally { await browser.close(); renderer.close(); }
});

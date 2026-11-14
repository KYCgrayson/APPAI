import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { registerProjectCardCss } from "./helpers/project-cards-render.mjs";
import { join } from "node:path";
import { createElement } from "react";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { hostedChromeBrowser } from "./helpers/hosted-chrome-browser.mjs";

test("feed pairs, reserved ratios, focus and dark/theme at 375/768/1280px (no media playback)", {
  skip: process.env.PROJECT_CARDS_BROWSER_TESTS !== "1" ? "Opt in with PROJECT_CARDS_BROWSER_TESTS=1 and existing Chrome." : false,
}, async () => {
  const loader = registerHostedRenderLoader();
  const cssHook = registerProjectCardCss();
  const browser = await hostedChromeBrowser(process.env.HOSTED_CHROME_BINARY || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  try {
    await browser.send("Network.enable");
    await browser.send("Network.setBlockedURLs", { urls: ["http://*", "https://*"] });
    const { ProjectCardsSection } = await import("../src/templates/sections/EditorialSections.tsx");
    const css = readFileSync(new URL("../src/templates/sections/editorial.module.css", import.meta.url), "utf8").replaceAll(/:global\(([^)]+)\)/g, "$1");
    const baseline = JSON.parse(readFileSync(new URL("./fixtures/project-cards-grid.json", import.meta.url), "utf8")).fixtures[2].html;
    const data = { layout: "feed" as const, heading: "The Paper Observatory", items: [
      { name: "How small ideas grow", href: "#episode", meta: ["Episode 12", "8 min"], description: "A fictional conversation about making space for curiosity.\nThree questions to take into the week.", media: [{ url: "https://example.com/art.png", alt: "Paper landscape", label: "6 key moments" }, { url: "https://example.com/chart.png", alt: "Episode sketch", href: "?t=90#episode", label: "▶ 5:12" }] },
      { name: "Field notes", featured: true, category: "Featured episode", media: [{ url: "https://example.com/field.png", alt: "Fictional field notes", aspect: "4:5" as const }] },
    ] };
    for (const width of [375, 768, 1280]) for (const darkMode of [false, true]) for (const themeColor of ["#b0461f", "#ffee00"]) {
      const html = await renderHtml(createElement(ProjectCardsSection, { data, themeColor, darkMode }));
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const setHtml = async (html: string) => browser.send("Page.setDocumentContent", { frameId: (await browser.send("Page.getFrameTree")).frameTree.frame.id, html: `<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}h1,h2,h3,p,figure{margin:0}a{color:inherit}.grid{display:grid}@media(min-width:768px){.md\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}}${css}</style></head><body>${html}</body></html>` });
      await setHtml(html);
      const result = await browser.evaluate(`(() => {
        const row = document.querySelector('.feedMedia'), tiles = [...row.children].map(el => el.getBoundingClientRect());
        document.querySelector('a').focus();
        return { overflow: document.documentElement.scrollWidth > innerWidth, width: document.querySelector('.feed').getBoundingClientRect().width,
          paired: tiles[0].top === tiles[1].top && tiles[0].right < tiles[1].left, ratio: tiles[0].width / tiles[0].height,
          focus: getComputedStyle(document.activeElement).outlineStyle, whiteSpace: getComputedStyle(document.querySelector('.feedDescription')).whiteSpace,
          accent: getComputedStyle(document.querySelector('section')).getPropertyValue('--accent'), badge: getComputedStyle(document.querySelector('.feedBadge')).color };
      })()`);
      assert.equal(result.overflow, false); assert.equal(result.paired, true); assert.ok(result.width <= 680);
      assert.ok(Math.abs(result.ratio - 16 / 9) < .02); assert.equal(result.focus, "solid"); assert.equal(result.whiteSpace, "pre-line");
      assert.equal(result.badge, "rgb(255, 255, 255)"); assert.match(result.accent, /rgb\(/);
      // Replace blocked requests with fictional inline artwork only for screenshots.
      if (process.env.PROJECT_CARDS_QA_DIR && themeColor === "#b0461f") {
        const save = async (name: string) => {
          await browser.evaluate(`(() => { document.querySelectorAll('img').forEach((img, i) => { img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="' + (i % 2 ? '#a0b8a5' : '#dfb98d') + '"/><circle cx="400" cy="250" r="140" fill="#f6f5f0"/><path d="M160 390L400 130L640 390Z" fill="#536b62"/></svg>'); }); })()`);
          const shot = await browser.send("Page.captureScreenshot", { format: "png" });
          mkdirSync(process.env.PROJECT_CARDS_QA_DIR!, { recursive: true });
          writeFileSync(join(process.env.PROJECT_CARDS_QA_DIR!, name), Buffer.from(shot.data, "base64"));
        };
        await save(`feed-${width}-${darkMode ? "dark" : "light"}.png`);
        if (!darkMode) { await setHtml(baseline); await save(`grid-before-${width}.png`); }
      }
    }
  } finally { await browser.close(); cssHook.deregister(); loader.deregister(); }
});

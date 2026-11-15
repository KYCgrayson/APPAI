import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createElement } from "react";
import { registerGalleryCss } from "./helpers/gallery-render.mjs";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { hostedChromeBrowser } from "./helpers/hosted-chrome-browser.mjs";

test("gallery order, ratios, equal row heights, badge contrast and keyboard focus at 375/768/1280px; no playback", {
  skip: process.env.GALLERY_BROWSER_TESTS !== "1" ? "Opt in with GALLERY_BROWSER_TESTS=1 and existing Chrome." : false,
}, async () => {
  const require = createRequire(import.meta.url);
  const cssPath = new URL("../src/app/globals.css", import.meta.url).pathname;
  const cssSource = readFileSync(cssPath, "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../";');
  const css = (await require("postcss")([require("@tailwindcss/postcss")({ optimize: true })]).process(cssSource, { from: cssPath })).css
    + readFileSync(new URL("../src/templates/sections/gallery.module.css", import.meta.url), "utf8");
  const loader = registerHostedRenderLoader(); const cssHook = registerGalleryCss();
  let browser: Awaited<ReturnType<typeof hostedChromeBrowser>> | undefined;
  try {
    browser = await hostedChromeBrowser(process.env.HOSTED_CHROME_BINARY || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    await browser.send("Network.enable");
    await browser.send("Network.setBlockedURLs", { urls: ["http://*", "https://*"] });
    const { GallerySection } = await import("../src/templates/sections/GallerySection.tsx");
    const items = Array.from({ length: 8 }, (_, i) => ({ url: `https://example.com/workshop-${i}.png`, alt: `Paper bridge prototype ${i + 1}`, href: `?t=${30 + i * 30}#video`, badge: i ? `${i}:00` : "Workshop day", caption: i === 1 ? "Testing a folded paper bridge with a deliberately long caption that spans several lines in a small tile" : `Workshop moment ${i + 1}` }));
    const setHtml = async (html: string, dark: boolean) => browser!.send("Page.setDocumentContent", { frameId: (await browser!.send("Page.getFrameTree")).frameTree.frame.id,
      html: `<!doctype html><html${dark ? ' class="dark"' : ''}><head><style>${css}</style></head><body style="margin:0;font-family:Arial;background:${dark ? '#111827' : '#fff'};color:${dark ? '#e5e7eb' : '#374151'}">${html}</body></html>` });
    const screenshot = async (name: string) => {
      if (!process.env.GALLERY_QA_DIR) return;
      // Fictional inline geometry only; no external media requests or video elements.
      await browser!.evaluate(`Promise.all([...document.images].map((img,i) => { img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="'+(i%2?'#b8cbd9':'#dfc9a5')+'"/><path d="M100 350L400 120L700 350Z" fill="#f9fafb"/><path d="M100 350L400 235L700 350Z" fill="#64748b"/></svg>'); return img.decode(); }))`);
      const shot = await browser!.send("Page.captureScreenshot", { format: "png" });
      mkdirSync(process.env.GALLERY_QA_DIR, { recursive: true });
      writeFileSync(join(process.env.GALLERY_QA_DIR, name), Buffer.from(shot.data, "base64"));
    };
    for (const width of [375, 768, 1280]) for (const dark of [false, true]) for (const themeColor of ["#2563eb", "#b0461f"]) for (const columns of [2, 3, 4]) for (const aspect of ["16:9", "1:1", "4:3", "4:5"] as const) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const html = await renderHtml(createElement(GallerySection, { themeColor, data: { heading: "Workshop recap", subheading: "Key moments from a fictional paper bridge workshop", layout: "grid", columns, aspect, items } }));
      await setHtml(html, dark);
      // Tab from the document, without triggering a link or player.
      await browser.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await browser.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      const actual = await browser.evaluate(`(() => {
        const grid = document.querySelector('.grid'), tiles = [...grid.children], rects = tiles.map(el => el.getBoundingClientRect());
        const boxes = [...grid.querySelectorAll('.media')].map(el => el.getBoundingClientRect());
        const badge = grid.querySelector('.badge'), badgeStyle = getComputedStyle(badge), active = document.activeElement;
        return { overflow: document.documentElement.scrollWidth > innerWidth, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          rects: rects.map(r => ({left:r.left,top:r.top,width:r.width,height:r.height})), ratios: boxes.map(r => r.width/r.height),
          focusFirst: active === tiles[0], focusStyle: getComputedStyle(active).outlineStyle, focusColor: getComputedStyle(active).outlineColor,
          name: active.getAttribute('aria-label'), badgeWidth: badge.getBoundingClientRect().width / boxes[0].width, badgeColor: badgeStyle.color, badgeBackground: badgeStyle.backgroundColor,
          clamp: getComputedStyle(grid.querySelector('.caption')).webkitLineClamp, captionColour: getComputedStyle(grid.querySelector('.caption')).color,
          nested: !!grid.querySelector('a a, a video, a button'), videos: document.querySelectorAll('video,audio').length };
      })()`);
      const context = `${width}/${dark}/${themeColor}/${columns}/${aspect}`;
      const expectedColumns = width < 768 ? 2 : width < 1024 ? Math.min(columns, 3) : columns;
      assert.equal(actual.overflow, false, context); assert.equal(actual.columns, expectedColumns, context);
      const [w, h] = aspect.split(":").map(Number);
      actual.ratios.forEach((ratio: number) => assert.ok(Math.abs(ratio - w / h) < .02, context));
      actual.rects.forEach((rect: { top: number; left: number; height: number }, i: number) => {
        const row = Math.floor(i / expectedColumns) * expectedColumns;
        assert.equal(rect.top, actual.rects[row].top, context); assert.equal(rect.height, actual.rects[row].height, context);
        if (i > row) assert.ok(rect.left > actual.rects[i - 1].left, context);
        else if (row) assert.ok(rect.top > actual.rects[row - 1].top, context);
      });
      assert.equal(actual.focusFirst, true, context); assert.equal(actual.focusStyle, "solid", context);
      assert.equal(actual.focusColor, themeColor === "#2563eb" ? "rgb(37, 99, 235)" : "rgb(176, 70, 31)", context);
      assert.equal(actual.name, "Workshop day — Workshop moment 1", context);
      assert.ok(actual.badgeWidth <= .405, context); assert.equal(actual.badgeColor, "rgb(255, 255, 255)"); assert.equal(actual.badgeBackground, "rgb(23, 23, 23)");
      assert.equal(actual.clamp, "2", context); assert.equal(actual.captionColour, dark ? "rgb(229, 231, 235)" : "rgb(55, 65, 81)");
      assert.equal(actual.nested, false); assert.equal(actual.videos, 0);
      if (columns === 3 && aspect === "16:9" && themeColor === "#2563eb") {
        await screenshot(`gallery-after-${width}-${dark ? "dark" : "light"}.png`);
        const baseline = JSON.parse(readFileSync(new URL("./fixtures/gallery-masonry.json", import.meta.url), "utf8")).fixtures[4].html;
        // Baseline includes video fixtures; omit those tiles for image-only visual QA.
        await setHtml(baseline.replace(/<div class="break-inside-avoid[^>]*><video[\s\S]*?<\/div>/g, ""), dark);
        assert.equal(await browser.evaluate("document.querySelectorAll('video,audio').length"), 0);
        await screenshot(`gallery-before-${width}-${dark ? "dark" : "light"}.png`);
      }
    }
  } finally { if (browser) await browser.close(); cssHook.deregister(); loader.deregister(); }
});

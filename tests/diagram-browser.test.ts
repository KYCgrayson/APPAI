import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { registerDiagramCss } from "./helpers/diagram-render.mjs";
import { hostedChromeBrowser } from "./helpers/hosted-chrome-browser.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { bilingualDiagramFixture, diagramFixture } from "./helpers/diagram-fixtures.ts";

// Inspect text itself: page-level scrollWidth misses text spilling between boxes.
const textGeometry = `(() => {
  const overflow = [], brokenWords = [], badArrows = [];
  const walker = document.createTreeWalker(document.querySelector('.section'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, el = node.parentElement;
    if (!node.textContent.trim() || el.closest('.srOnly') || !el.getClientRects().length) continue;
    const block = getComputedStyle(el).display === 'inline' ? el.parentElement : el;
    if (block.scrollWidth > block.clientWidth) overflow.push({ text: node.textContent, scrollWidth: block.scrollWidth, clientWidth: block.clientWidth });
    const box = el.closest('.box') || el.closest('.item') || el.closest('.inner');
    const bounds = box.getBoundingClientRect(), range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.left < bounds.left - .5 || rect.right > bounds.right + .5 || rect.top < bounds.top - .5 || rect.bottom > bounds.bottom + .5) overflow.push({ text: node.textContent, reason: 'outside box' });
    }
    for (const word of node.textContent.matchAll(/[A-Za-z]+/g)) {
      range.setStart(node, word.index); range.setEnd(node, word.index + word[0].length);
      if (range.getClientRects().length > 1) brokenWords.push(word[0]);
    }
  }
  for (const list of document.querySelectorAll('.steps,.cycle')) {
    const boxes = [...list.children];
    boxes.forEach((box, index) => {
      const arrow = box.querySelector('.arrow');
      if (!arrow || !arrow.getClientRects().length) return;
      const next = boxes[index + 1] || boxes[0];
      const a = box.getBoundingClientRect(), b = next.getBoundingClientRect();
      const matrix = getComputedStyle(arrow).transform;
      const pointsToNext = matrix === 'none' ? b.left >= a.right && Math.abs(a.top - b.top) < 1
        : matrix === 'matrix(0, 1, -1, 0, 0, 0)' ? b.top >= a.bottom && b.left < a.right && b.right > a.left
        : matrix === 'matrix(-1, 0, 0, -1, 0, 0)' ? b.right <= a.left && Math.abs(a.top - b.top) < 1
        : matrix === 'matrix(0, -1, 1, 0, 0, 0)' && b.bottom <= a.top && b.left < a.right && b.right > a.left;
      if (!pointsToNext) badArrows.push({ index, matrix });
    });
    if (list.matches('.cycle') && getComputedStyle(list).display === 'flex') {
      const last = boxes.at(-1), cue = last.querySelector('.returnCue');
      if (last.querySelector('.arrow').getClientRects().length || !cue?.getClientRects().length || cue.textContent !== '↶ 1' || cue.getAttribute('aria-hidden') !== 'true') badArrows.push({ reason: 'missing return to 1' });
    }
  }
  return { overflow, brokenWords, badArrows };
})()`;

test("diagram browser geometry, AA, focus and before/after screenshots; no media playback", {
  skip: process.env.DIAGRAM_BROWSER_TESTS !== "1" ? "Opt in with DIAGRAM_BROWSER_TESTS=1 and existing Chrome." : false,
}, async () => {
  const hooks = [registerHostedRenderLoader(), registerDiagramCss()];
  let browser: Awaited<ReturnType<typeof hostedChromeBrowser>> | undefined;
  try {
    const { DiagramSection } = await import("../src/templates/sections/DiagramSection.tsx");
    const require = createRequire(import.meta.url);
    const path = new URL("../src/app/globals.css", import.meta.url).pathname;
    const source = readFileSync(path, "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../";');
    const css = (await require("postcss")([require("@tailwindcss/postcss")({ optimize: true })]).process(source, { from: path })).css
      + readFileSync(new URL("../src/templates/sections/diagram.module.css", import.meta.url), "utf8");
    const doc = (html: string, dark: boolean) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body style="margin:0;font-family:Arial;background:${dark ? "#111827" : "#fff"};color:${dark ? "#f3f4f6" : "#111827"}"><h1 style="padding:1rem;font-size:2rem">Paper workshop</h1>${html}</body></html>`;
    const dir = process.env.DIAGRAM_QA_DIR;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      for (const darkMode of [false, true]) {
        const html = await renderHtml(createElement(DiagramSection, { data: diagramFixture, themeColor: "#ffff00", darkMode }));
        writeFileSync(`${dir}/after-${darkMode ? "dark" : "light"}.html`, doc(html, darkMode));
        writeFileSync(`${dir}/before-${darkMode ? "dark" : "light"}.html`, doc("", darkMode));
      }
    }
    browser = await hostedChromeBrowser(process.env.HOSTED_CHROME_BINARY || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    await browser.send("Network.enable");
    await browser.send("Network.setBlockedURLs", { urls: ["http://*", "https://*"] });
    const stress = { items: [
      { kind: "compare", title: "x".repeat(80), columns: Array.from({ length: 4 }, () => ({ label: "x".repeat(40), points: Array(6).fill("x".repeat(160)) })) },
      { kind: "steps", title: "Maximum steps", steps: Array.from({ length: 8 }, () => ({ label: "x".repeat(40), detail: "x".repeat(160) })) },
      { kind: "layers", title: "Maximum layers", focus: 5, layers: Array.from({ length: 6 }, () => ({ label: "x".repeat(40), detail: "x".repeat(160) })) },
      ...[3, 4, 5, 6].map(count => ({ kind: "cycle", title: `Cycle ${count}`, steps: Array.from({ length: count }, () => ({ label: "x".repeat(40), detail: "x".repeat(160) })) })),
    ] };
    for (const width of [320, 375, 640, 641, 768, 815, 816, 1024, 1040, 1280, 1440]) for (const darkMode of [false, true]) for (const data of [diagramFixture, stress, bilingualDiagramFixture]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const html = await renderHtml(createElement(DiagramSection, { data, themeColor: "#ffff00", darkMode }));
      const frameId = (await browser.send("Page.getFrameTree")).frameTree.frame.id;
      await browser.send("Page.setDocumentContent", { frameId, html: doc(html, darkMode) });
      const result = await browser.evaluate(`(() => {
        const background = el => { while(el) { const c = getComputedStyle(el).backgroundColor; if(c !== 'rgba(0, 0, 0, 0)') return c; el = el.parentElement; } return 'rgb(255, 255, 255)'; };
        const lum = rgb => rgb.match(/\\d+/g).slice(0, 3).map(Number).map(c => c/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4).reduce((s,c,i) => s+c*[.2126,.7152,.0722][i],0);
        const contrast = el => { const a=lum(getComputedStyle(el).color), b=lum(background(el)); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); };
        return { width: document.documentElement.scrollWidth, media: document.querySelectorAll('video,audio,canvas,img,iframe').length,
          contrast: [...document.querySelectorAll('.section h2,.section h3,.section h4,.section p,.section a,.number,.points li,.returnCue')].filter(el => el.getClientRects().length).map(contrast),
          directions: [...document.querySelectorAll('.arrow')].filter(el => el.getClientRects().length).map(el => getComputedStyle(el).transform),
          layouts: [...document.querySelectorAll('.columns,.steps,.cycle,.layers')].map(el => [...el.children].map(c => { const r=c.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom}; })) };
      })()`);
      assert.ok(result.width <= width, `${width}/${darkMode}/${data === stress}: overflow ${result.width}`);
      const text = await browser.evaluate(textGeometry);
      const context = `${width}/${darkMode}/${data === stress ? 'stress' : data === bilingualDiagramFixture ? 'bilingual' : 'fixture'}`;
      assert.deepEqual(text.overflow, [], `${context}: text exceeds its box`);
      if (data !== stress) assert.deepEqual(text.brokenWords, [], `${context}: English words break mid-word`);
      assert.deepEqual(text.badArrows, [], `${context}: arrows must point to the next step or return to 1`);
      assert.equal(result.media, 0);
      result.contrast.forEach((ratio: number) => assert.ok(ratio >= 4.5, `${width}/${darkMode}: contrast ${ratio}`));
      if (width <= 640) {
        result.directions.forEach((matrix: string) => assert.equal(matrix, "matrix(0, 1, -1, 0, 0, 0)"));
        result.layouts.forEach((rects: { left: number; top: number; bottom: number }[]) => rects.forEach((rect, i) => { assert.equal(rect.left, rects[0].left); if (i) assert.ok(rect.top > rects[i - 1].bottom); }));
      }
      for (const rects of result.layouts) for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j]; assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, "Diagram nodes overlap");
      }
      if (dir && data === bilingualDiagramFixture) {
        const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        writeFileSync(`${dir}/bilingual-${width}-${darkMode ? "dark" : "light"}.png`, Buffer.from(shot.data, "base64"));
      }
      if (data === diagramFixture) {
        await browser.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        await browser.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        assert.equal(await browser.evaluate("document.activeElement.tagName"), "A");
        assert.equal(await browser.evaluate("getComputedStyle(document.activeElement).outlineStyle"), "solid");
        if (dir) {
          const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
          writeFileSync(`${dir}/after-${width}-${darkMode ? "dark" : "light"}.png`, Buffer.from(shot.data, "base64"));
          await browser.send("Page.setDocumentContent", { frameId, html: doc("", darkMode) });
          const before = await browser.send("Page.captureScreenshot", { format: "png" });
          writeFileSync(`${dir}/before-${width}-${darkMode ? "dark" : "light"}.png`, Buffer.from(before.data, "base64"));
        }
      }
    }
    // Sweep every CSS-pixel width to catch the gaps immediately around wrapping thresholds.
    const frameId = (await browser.send("Page.getFrameTree")).frameTree.frame.id;
    await browser.send("Page.setDocumentContent", { frameId, html: doc(await renderHtml(createElement(DiagramSection, { data: bilingualDiagramFixture, themeColor: "#2563eb" })), false) });
    for (let width = 320; width <= 1440; width++) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const result: { overflow: unknown[]; brokenWords: string[]; badArrows: unknown[] } = await browser.evaluate(textGeometry);
      assert.deepEqual(result, { overflow: [], brokenWords: [], badArrows: [] }, `bilingual width sweep: ${width}px`);
    }
  } finally { if (browser) await browser.close(); hooks.reverse().forEach(h => h.deregister()); }
});

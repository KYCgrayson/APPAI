import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { gameSectionCopy } from "../src/lib/game-section-copy.ts";
import { PassThrough } from "node:stream";
import { registerHostedRenderLoader, registerDirectoryFixtures, registerGameRenderState } from "./helpers/hosted-render-loader.mjs";

const hooks = registerHostedRenderLoader();
const state = { expanded: false };
Object.assign(globalThis, { [Symbol.for("appai.test.game-render")]: state });
const states = registerGameRenderState();
const intl = registerDirectoryFixtures({ translated: true });
test.after(() => { intl.deregister(); states.deregister(); hooks.deregister(); });
const { PageRenderer } = await import("../src/templates/shared/PageRenderer.tsx");
const example = JSON.parse(readFileSync(new URL("../docs/examples/game.example.json", import.meta.url), "utf8"));
function render(page: typeof example) {
  return new Promise<string>((resolve, reject) => {
    const output = new PassThrough();
    let html = "";
    output.on("data", chunk => { html += chunk; });
    output.on("end", () => resolve(html));
    const stream = renderToPipeableStream(createElement(PageRenderer, { page }), { onAllReady() { stream.pipe(output); }, onError: reject });
  });
}
test("GAME renders one H1, description, fullscreen control, instructions and FAQPage", async () => {
  const html = await render(example);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  for (const text of [example.title, "Play fullscreen", "How to play", example.content.sections[0].data.description]) assert.ok(html.includes(text));
  const faq = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1])).find(schema => schema["@type"] === "FAQPage");
  assert.equal(faq.mainEntity[0].name, example.content.sections[0].data.faq[0].question);
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, example.content.sections[0].data.faq[0].answer);
  assert.match(html, /aspect-ratio:9\/16/);
  assert.doesNotMatch(html, /appai_session=/);
  assert.match(html, /locale=en/);
});
test("game renders alongside existing sections on another template and respects access", async () => {
  const page = { ...example, template: "APP_LANDING", content: { ...example.content, sections: [{ type: "hero", order: -1, data: { headline: "Family games" } }, ...example.content.sections] } };
  assert.equal([...(await render(page)).matchAll(/<h1\b/g)].length, 1);
  const gated = structuredClone(example);
  gated.content.sections[0].data.access = "login";
  const html = await render(gated);
  assert.doesNotMatch(html, /<iframe/);
});


test("game identity true never mints a render session", async () => {
  const page = structuredClone(example);
  page.id = "fixture-page";
  page.content.sections[0].data.identity = true;
  const html = await render(page);
  assert.match(html, /<iframe/);
  assert.doesNotMatch(html, /appai_session=/);
});

test("games use narrower permissions while iframe-tool keeps its existing permissions", async () => {
  const game = await render(example);
  assert.match(game, /sandbox="allow-scripts allow-same-origin"/);
  assert.match(game, /allow="fullscreen &#x27;none&#x27;; gamepad; accelerometer; gyroscope"/);
  assert.doesNotMatch(game, /clipboard-write|allow-forms|allow-downloads|allow-popups/);
  const tool = await render({ ...example, template: "APP_LANDING", content: { sections: [{ type: "iframe-tool", data: { src: "https://tool.pages.dev" } }] } });
  assert.match(tool, /sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"/);
  assert.match(tool, /allow="fullscreen; clipboard-write; gamepad; accelerometer; gyroscope"/);
});

test("inline and expanded frames retain a localized platform notice beside the control", async () => {
  const hostname = new URL(example.content.sections[0].data.gameUrl).hostname;
  for (const expanded of [false, true]) for (const locale of ["en", "zh-TW", "zh-CN", "es", "ja", "ko", "de", "fr", "hi"]) {
    state.expanded = expanded;
    try {
      const html = (await render({ ...example, locale })).replace(/<!--.*?-->/g, "");
      const copy = gameSectionCopy(locale, hostname);
      assert.ok(html.includes(copy.notice), locale);
      assert.ok(html.includes(expanded ? copy.close : copy.play), locale);
      assert.match(html, /relative z-10 flex shrink-0/);
      assert.ok(html.indexOf(copy.notice) < html.indexOf("<iframe"));
      if (expanded) {
        assert.match(html, /fixed inset-0 z-50 flex flex-col overflow-hidden/);
        assert.match(html, /min-h-0 flex-1 overflow-auto/);
      }
    } finally { state.expanded = false; }
  }
  assert.equal(gameSectionCopy("unknown", hostname).notice, gameSectionCopy("en", hostname).notice);
});

test("the inline game frame has only one horizontal padding layer at mobile widths", async () => {
  const html = await render(example);
  const frameAncestors = html.slice(html.indexOf('<section class="min-w-0 break-words'), html.indexOf("<iframe"));
  assert.equal([...frameAncestors.matchAll(/px-4 sm:px-6/g)].length, 1);
  assert.ok(frameAncestors.includes('<section class="min-w-0">'));
});

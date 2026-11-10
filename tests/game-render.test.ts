import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { PassThrough } from "node:stream";
import { registerHostedRenderLoader, registerDirectoryFixtures } from "./helpers/hosted-render-loader.mjs";

const hooks = registerHostedRenderLoader();
const intl = registerDirectoryFixtures({ translated: true });
test.after(() => { intl.deregister(); hooks.deregister(); });
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

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { registerMainHostedBaseline } from "./helpers/hosted-chrome-regression.mjs";
import { registerDiagramCss } from "./helpers/diagram-render.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
import { diagramFixture, diagramContent } from "./helpers/diagram-fixtures.ts";
import { page } from "./fixtures/pr5-pages.ts";
import { proseThemeVariables } from "../src/lib/prose-theme.ts";
import { diagramStrings } from "../src/templates/sections/diagram-strings.ts";

const hooks = [registerHostedRenderLoader(), registerDiagramCss()];
const baseline = registerMainHostedBaseline("3ddf782");
test.after(() => { baseline.deregister(); hooks.reverse().forEach(h => h.deregister()); });
const { DiagramSection } = await import("../src/templates/sections/DiagramSection.tsx");
const { PageRenderer } = await import("../src/templates/shared/PageRenderer.tsx");
const { PageRenderer: BeforeRenderer } = await import(baseline.moduleUrl("src/templates/shared/PageRenderer.tsx"));
const render = (data: unknown, extra = {}) => renderHtml(createElement(DiagramSection, { data, themeColor: "#ffff00", ...extra }));

test("all-kind fixture renders semantic lists, headings, focus, safe links and localised repeating cycle without client media", async () => {
  for (const darkMode of [false, true]) for (const locale of ["en", "zh-TW", "zh-CN", "fr-CA", "hi", "zz"]) {
    const html = await render(diagramFixture, { darkMode, locale });
    assert.equal((html.match(/<article\b/g) ?? []).length, 4);
    assert.equal((html.match(/<ol role="list"/g) ?? []).length, 3);
    assert.equal((html.match(/data-focus="true"/g) ?? []).length, 1);
    assert.equal((html.match(/<h3/g) ?? []).length, 4);
    assert.match(html, /<h2>A fictional paper workshop<\/h2>/);
    assert.match(html, /href="https:\/\/example.com\/workshop" target="_blank" rel="noreferrer"/);
    assert.match(html, /href="\?t=90#workshop-video"/);
    assert.ok(html.includes(diagramStrings(locale).repeats));
    const arrows = [...html.matchAll(/<span class="arrow"[^>]*>/g)];
    assert.equal(arrows.length, 5); arrows.forEach(match => assert.ok(match[0].includes('aria-hidden="true"')));
    assert.match(html, /data-direction="up"/);
    assert.match(html, /<span class="returnCue" aria-hidden="true">↶ 1<\/span>/);
    assert.equal((html.match(/<svg/g) ?? []).length, 1);
    assert.doesNotMatch(html, /<script|<img|<video|<iframe|<canvas|<button/);
  }
});

test("raw XSS strings are React-escaped; markdown is literal and unsafe stored links never render", async () => {
  const malicious = '<img src=x onerror="alert(1)">';
  const html = await render({ items: [{ kind: "steps", title: malicious, takeaway: "**Literal** & <tag>", icon: "constructor", steps: [{ label: "<script>x</script>", detail: malicious }, { label: "Second" }] }] });
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /\*\*Literal\*\* &amp; &lt;tag&gt;/);
  assert.doesNotMatch(html, /<script|<img|<svg|<strong/);
  for (const icon of ["toString", "https://example.com/icon.png", "🌿", "unknown-icon"]) assert.doesNotMatch(await render({ items: [{ ...diagramFixture.items[0], icon }] }), /<svg|<img/);
  for (const url of ["javascript:alert(1)", "http://example.com", "//example.com", "data:text/html,x"]) assert.equal(await render({ items: [{ ...diagramFixture.items[0], link: { label: "Bad", url } }] }), "");
});

test("cycle grid follows DOM order around a closed loop for every supported node count", async () => {
  for (const count of [3, 4, 5, 6]) {
    const html = await render({ items: [{ kind: "cycle", title: "Repeat", steps: Array.from({ length: count }, (_, i) => ({ label: `Step ${i + 1}` })) }] });
    const nodes = [...html.matchAll(/<li class="box"[^>]*style="grid-row:(\d);grid-column:([^;"]+)/g)];
    assert.equal(nodes.length, count);
    assert.deepEqual(nodes.slice(0, Math.ceil(count / 2)).map(match => [match[1], match[2]]), Array.from({ length: Math.ceil(count / 2) }, (_, i) => ["1", String(i + 1)]));
    assert.equal(nodes.at(-1)![2], `1 / span ${count % 2 ? 2 : 1}`);
    assert.equal((html.match(/data-direction="down"/g) ?? []).length, 1);
    assert.equal((html.match(/data-direction="up"/g) ?? []).length, 1);
  }
});

test("light and dark accents/body colors meet AA on every diagram surface; CSS stacks all forms at 640px", () => {
  const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const contrast = (a: string, b: string) => { const [low, high] = [luminance(a), luminance(b)].sort((a, b) => a - b); return (high + .05) / (low + .05); };
  for (const theme of ["#ffffff", "#000000", "#ffff00", "#ff0000", "#00ff00", "#0000ff", "#b0461f", "#2563eb"]) for (const dark of [false, true]) {
    const accent = proseThemeVariables(theme)![dark ? "--page-theme-link-dark" : "--page-theme-link-light"];
    for (const surface of dark ? ["#111827", "#1f2937"] : ["#ffffff", "#f9fafb"]) {
      assert.ok(contrast(accent, surface) >= 4.5, `${accent}/${surface}`);
      assert.ok(contrast(dark ? "#f3f4f6" : "#111827", surface) >= 4.5);
    }
  }
  const css = readFileSync(new URL("../src/templates/sections/diagram.module.css", import.meta.url), "utf8");
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.columns, \.steps, \.cycle \{ display: flex; flex-direction: column; \}/);
  assert.match(css, /\.layers \{ display: flex; flex-direction: column/);
  assert.match(css, /\.arrow, \.cycle \.arrow\[data-direction\][^}]*transform: rotate\(90deg\)/);
  assert.match(css, /a:focus-visible/);
  assert.doesNotMatch(readFileSync(new URL("../src/templates/sections/DiagramSection.tsx", import.meta.url), "utf8"), /use client|useEffect|useState|dangerouslySetInnerHTML/);
});

test("pages without diagram are byte-identical to the branch base across templates, modes and render versions", async () => {
  const sections = [
    ...diagramContent({}).sections.slice(0, 1),
    { type: "stats", order: 1, data: { items: [{ value: "12", label: "Models" }] } },
    { type: "schedule", order: 2, data: { items: [{ time: "Day 1", title: "Sketch" }] } },
    { type: "features", order: 3, data: { items: [{ title: "Paper", description: "Recyclable material" }] } },
    { type: "entries", order: 4, data: { items: [{ title: "A fictional milestone", description: "The first bridge" }] } },
    { type: "gallery", order: 5, data: { items: [{ url: "https://example.com/model.png", caption: "Prototype" }] } },
    { type: "project-cards", order: 6, data: { items: [{ name: "Paper bridge", description: "A model" }] } },
  ];
  for (const template of ["APP_LANDING", "COMPANY_PROFILE", "PRODUCT_SHOWCASE", "PORTFOLIO", "LINK_IN_BIO", "PERSON", "GAME"]) for (const darkMode of [false, true]) for (const renderVersion of [1, 2]) {
    const row = page("paper-workshop", { template, darkMode, content: { renderVersion, sections } });
    assert.equal(await renderHtml(createElement(PageRenderer, { page: row })), await renderHtml(createElement(BeforeRenderer, { page: row })));
  }
});

test("diagram heading and subheading survive every render version, including omitted", async () => {
  for (const renderVersion of [undefined, 1, 2]) {
    const row = page("paper-workshop", { content: { ...diagramContent(diagramFixture), renderVersion } });
    const html = await renderHtml(createElement(PageRenderer, { page: row }));
    assert.ok(html.includes(diagramFixture.heading));
    assert.ok(html.includes(diagramFixture.subheading));
  }
});

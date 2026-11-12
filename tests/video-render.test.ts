import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
const loader = registerHostedRenderLoader();
test.after(() => loader.deregister());
const { VideoSection } = await import("../src/templates/sections/VideoSection.tsx");
const { PageRenderer } = await import("../src/templates/shared/PageRenderer.tsx");
const { Prose } = await import("../src/templates/shared/Prose.tsx");
const { videoStrings } = await import("../src/templates/sections/video-strings.ts");
const url = "https://youtu.be/Abc_123-xyz";

test("provider facade has no iframe or SDK on SSR; moments remain external time links without JS", async () => {
  const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", locale: "zh-TW", sectionId: "intro", pageUrl: "https://appai.info/p/fictional", data: { url, moments: [{ t: 90, title: "Second", text: "**Safe** [link](https://example.test)" }, { t: 0, title: "First" }] } }));
  assert.doesNotMatch(html, /<iframe|iframe_api|player\.js/);
  assert.match(html, /src="https:\/\/i.ytimg.com\/vi\/Abc_123-xyz\/hqdefault.jpg"/);
  assert.match(html, /重點時刻/);
  assert.match(html, /href="https:\/\/www.youtube.com\/watch\?v=Abc_123-xyz&amp;t=90s"/);
  assert.match(html, /<strong>Safe<\/strong>/);
  assert.ok(html.indexOf('>First</span>') < html.indexOf('>Second</span>'));
  const vimeo = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: { url: "https://vimeo.com/123/hash123", moments: [{ t: 1, title: "Start" }] } }));
  assert.doesNotMatch(vimeo, /<iframe|<img|<script src=/);
  assert.match(vimeo, /href="https:\/\/vimeo.com\/123\/hash123#t=1s"/);
});

test("title/text XSS stays inert in HTML and JSON-LD, using the shared safe Markdown renderer", async () => {
  const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: { url, moments: [{ t: 0, title: '</script><img src=x onerror="alert(1)">', text: '<script>alert(1)</script>\n\n**Bold** [bad](javascript:alert%281%29) [▶ 1:30](?t=90#intro)' }] } }));
  assert.doesNotMatch(html, /<img src="x"|<script>alert|href="javascript:/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /href="\?t=90#intro"/);
  for (const editorialLinks of [false, true]) assert.match(await renderHtml(createElement(Prose, { editorialLinks }, "[▶ 1:30](?t=90#intro)")), /href="\?t=90#intro"/);
});

test("legacy direct-file video markup differs only by removal of fabricated uploadDate (fixed clock)", async t => {
  t.mock.method(Date.prototype, "toISOString", () => "2026-01-01T00:00:00.000Z");
  const old = readFileSync(new URL("./fixtures/video-legacy.html", import.meta.url), "utf8").trim();
  const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: { url: "https://example.test/video.mp4", heading: "Demo", subheading: "Overview", caption: "A fictional demo" } }));
  assert.equal(html, old.replace(',"uploadDate":"2026-01-01T00:00:00.000Z"', ""));
});

test("page wrapper uses data.id before section.id and supplies localized child clip URLs", async () => {
  const html = await renderHtml(createElement(PageRenderer, { page: { slug: "lesson", parentSlug: "fictional", locale: "ja", isDefault: false, title: "Example", template: "APP_LANDING", content: { sections: [
    { type: "video", id: "old-id", data: { id: "intro-video", url, moments: [{ t: 90, title: "Scene" }] } },
    { type: "video", id: "second-video", data: { url } },
  ] } } }));
  assert.match(html, /id="intro-video"/);
  assert.doesNotMatch(html, /id="old-id"/);
  assert.match(html, /id="second-video"/);
  assert.match(html, /主なシーン/);
  assert.match(html, /https:\/\/appai.info\/p\/fictional\/ja\/lesson\?t=90#intro-video/);
});

test("locale table uses exact match, primary fallback and default English", () => {
  for (const [locale, heading] of [["en", "Key moments"], ["zh-TW", "重點時刻"], ["zh-CN", "重点时刻"], ["ja", "主なシーン"], ["ko", "주요 장면"], ["es-MX", "Momentos clave"], ["fr-CA", "Moments clés"], ["de-AT", "Wichtige Momente"], ["xx-YY", "Key moments"]]) assert.equal(videoStrings(locale).heading, heading);
});

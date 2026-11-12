import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { registerHostedRenderLoader, registerDirectoryFixtures } from "./helpers/hosted-render-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";
const loader = registerHostedRenderLoader();
const translations = registerDirectoryFixtures();
test.after(() => { translations.deregister(); loader.deregister(); });
const { VideoSection } = await import("../src/templates/sections/VideoSection.tsx");
const { LegacyVideoSection } = await import("../src/templates/sections/LegacyVideoSection.tsx");
const { parseVideoUrl } = await import("../src/lib/video-url.ts");
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

test("supported legacy providers and files render byte-identically to origin/main with fabricated uploadDate removed", async () => {
  const baseline = JSON.parse(readFileSync(new URL("./fixtures/video-legacy-urls.json", import.meta.url), "utf8"));
  for (const fixture of baseline.fixtures) {
    if (["https://example.test", "https://vimeo.com/showcase/123"].includes(fixture.data.url)) continue; // non-media/unparseable provider URLs now use external cards
    const render = (data: typeof fixture.data) => renderHtml(createElement(VideoSection, { themeColor: "#334455", data }));
    assert.equal(await render(fixture.data), fixture.html, fixture.data.url);
    assert.equal(await render({ ...fixture.data, uploadDate: "bad", duration: "bad" }), fixture.html, "invalid optional SEO never breaks the legacy output");
  }
  const old = readFileSync(new URL("./fixtures/video-legacy.html", import.meta.url), "utf8").trim();
  const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: { url: "https://example.test/video.mp4", heading: "Demo", subheading: "Overview", caption: "A fictional demo", uploadDate: "2024/01/01" } }));
  assert.equal(html, old.replace('"2026-01-01T00:00:00.000Z"', '"2024-01-01"'));
});

test("unknown stored URLs use external link cards; provider substrings never create an iframe", async () => {
  for (const url of ["https://example.test", "https://fictional-tool.vercel.app/?ref=youtube.com", "https://example.test/youtube.com/watch?v=short", "https://example.test/?ref=vimeo.com/123", "https://example.test/#youtube.com"]) {
    const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: { url } }));
    assert.doesNotMatch(html, /<iframe|<video|Video unavailable/);
    assert.match(html, /<span>Open video<\/span>/);
    assert.ok(html.includes(`<span>${new URL(url).hostname}</span>`));
    assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  }
  for (const url of ["https://youtube.com.evil.test/watch?v=short", "https://notyoutube.com/watch?v=short", "https://vimeo.com.evil.test/123", "javascript:alert(1)"]) {
    const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: { url } }));
    assert.match(html, /Video unavailable/);
    assert.doesNotMatch(html, /<iframe|<a /);
  }
  for (const url of ["https://sub.youtube.com/channel/fictional", "https://sub.vimeo.com/showcase/123", "https://sub.youtube-nocookie.com/embed/short"]) {
    const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: { url } }));
    assert.doesNotMatch(html, /<iframe|"embedUrl"/);
    assert.match(html, /<span>Open video<\/span>/);
  }
});

test("legacy fixture without a Vimeo ID changes only from a raw iframe/embedUrl to an external card", async () => {
  const baseline = JSON.parse(readFileSync(new URL("./fixtures/video-legacy-urls.json", import.meta.url), "utf8"));
  const fixture = baseline.fixtures.find((row: { data: { url: string } }) => row.data.url === "https://vimeo.com/showcase/123");
  const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: fixture.data }));
  const expected = fixture.html.replace('"embedUrl":"https://vimeo.com/showcase/123",', "")
    .replace(/<div class="relative w-full".*?<\/iframe><\/div>/, '<a href="https://vimeo.com/showcase/123" target="_blank" rel="noopener noreferrer" class="flex flex-col gap-2 p-6 underline"><span>Open video</span><span>vimeo.com</span></a>');
  assert.equal(html, expected);
});

test("legacy provider embeds are rebuilt from parsed IDs and keep main fixture parity", async () => {
  const baseline = JSON.parse(readFileSync(new URL("./fixtures/video-legacy-urls.json", import.meta.url), "utf8"));
  let providers = 0;
  for (const fixture of baseline.fixtures) {
    if (!fixture.html.includes("<iframe") || fixture.data.url === "https://vimeo.com/showcase/123") continue;
    providers++;
    assert.equal(parseVideoUrl(fixture.data.url), null, "fixture exercises the grandfathered legacy branch");
    const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: fixture.data }));
    assert.equal(html, fixture.html, fixture.data.url);
    assert.doesNotMatch(html, new RegExp(`src="${fixture.data.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.ok(providers >= 3, "working legacy YouTube and Vimeo fixtures are present");
  for (const url of ["https://youtube.com/watch", "https://www.youtube.com/@fictional", "https://m.youtube.com/watch?autoplay=1", "https://youtu.be/", "https://www.youtube-nocookie.com/embed/", "https://vimeo.com/showcase/123", "https://player.vimeo.com/video/not-a-video"]) {
    const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: { url } }));
    assert.doesNotMatch(html, /<iframe|"embedUrl"/);
    assert.match(html, /<span>Open video<\/span>/);
    assert.ok(html.includes(`<span>${new URL(url).hostname}</span>`));
  }
});

for (const locale of ["zh-TW", "xx-YY"]) test(`${locale}: hosted locale reaches legacy cards, unavailable copy, iframe titles and animation alt text`, async () => {
  const zh = locale === "zh-TW";
  const html = await renderHtml(createElement(PageRenderer, { page: { slug: "legacy-locales", title: "Demo", locale, template: "APP_LANDING", content: { sections: [
    { type: "video", data: { url: "https://vimeo.com/showcase/123" } },
    { type: "video", data: { url: "javascript:alert(1)" } },
    { type: "video", data: { url: "https://youtube.com/watch?v=short" } },
    { type: "video", data: { url: "https://vimeo.com/123/extra/path" } },
    { type: "video", data: { url: "https://example.test/demo.gif" } },
    { type: "video", data: { url: "http://example.test/demo.gif" } },
  ] } } }));
  assert.ok(html.includes(`<span>${zh ? "開啟影片" : "Open video"}</span>`));
  assert.ok(html.includes(`<p>${zh ? "影片無法使用" : "Video unavailable"}</p>`));
  assert.equal((html.match(new RegExp(`title="${zh ? "影片" : "Video"}"`, "g")) || []).length, 2);
  assert.equal((html.match(new RegExp(`alt="${zh ? "動畫" : "Animation"}"`, "g")) || []).length, 2);
  if (zh) assert.doesNotMatch(html, /Open video|Video unavailable|title="Video"|alt="Animation"/);
  const unavailable = await renderHtml(createElement(LegacyVideoSection, { themeColor: "#334455", locale, data: { url: "javascript:alert(1)" } }));
  assert.ok(unavailable.includes(zh ? "影片無法使用" : "Video unavailable"));
});

test("two uncaptioned videos use their distinct section headings as JSON-LD names", async () => {
  for (const renderVersion of [undefined, 2]) {
    const html = await renderHtml(createElement(PageRenderer, { page: { slug: "lessons", title: "All lessons", template: "APP_LANDING", content: { renderVersion, sections: [
      { type: "video", data: { url, heading: "Drawing orbits" } },
      { type: "video", data: { url: "https://vimeo.com/123", heading: "Exporting artwork" } },
    ] } } }));
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1])).filter(schema => schema["@type"] === "VideoObject");
    assert.deepEqual(schemas.map(schema => schema.name), ["Drawing orbits", "Exporting artwork"]);
    for (const schema of schemas) assert.equal(Object.hasOwn(schema, "description"), false);
    assert.equal(/<h2/.test(html), renderVersion === 2, "legacy visible headings stay unchanged");
  }
  const legacy = await renderHtml(createElement(VideoSection, { themeColor: "#334455", pageTitle: "All lessons", data: { url: "http://example.test/video.mp4", heading: "A legacy lesson" } }));
  assert.match(legacy, /"name":"A legacy lesson"/);
});

test("provider play facade uses an aria-hidden SVG instead of an emoji glyph", async () => {
  const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: { url } }));
  assert.match(html, /<svg[^>]+viewBox="0 0 24 24"[^>]+aria-hidden="true"/);
  assert.doesNotMatch(html, /▶/);
});

test("legacy moments are plain text without links, a facade, a controller or Clip markup", async () => {
  const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", data: { url: "https://example.test/stream.m3u8", startAt: 90, moments: [{ t: 90, title: "A scene", text: "[plain](https://example.test)" }] } }));
  assert.match(html, /<video class="w-full" controls=""><source src="https:\/\/example.test\/stream.m3u8"\/><\/video>/);
  assert.match(html, /1:30 A scene/);
  assert.match(html, /\[plain\]\(https:\/\/example.test\)/);
  assert.doesNotMatch(html, /<a |<iframe|<img|data-video-time|Clip|<script/);
});

test("YouTube live is recognized; invalid optional SEO cannot hide a working provider", async () => {
  const html = await renderHtml(createElement(VideoSection, { themeColor: "#334455", pageTitle: "Live lesson", data: { url: "https://youtube.com/live/Abc_123-xyz", uploadDate: "bad", duration: "bad", thumbnail: "javascript:alert(1)", moments: [{ t: 90, title: "Scene" }] } }));
  assert.match(html, /hqdefault.jpg/);
  assert.match(html, /"name":"Live lesson"/);
  assert.match(html, /data-video-time="90"/);
  assert.doesNotMatch(html, /Video unavailable|uploadDate|duration|javascript:/);
});

test("only the first visible facade thumbnail is eager and high priority, with stable dimensions", async () => {
  const html = await renderHtml(createElement(PageRenderer, { page: { slug: "demo", title: "Lessons", template: "APP_LANDING", content: { sections: [
    { type: "video", data: { url: "https://example.test/stream.m3u8" } },
    { type: "video", data: { url: "https://example.test/demo.mp4" } },
    { type: "video", data: { url: "https://vimeo.com/123" } },
    { type: "video", data: { url, access: "login" } },
    { type: "video", data: { url } },
    { type: "video", data: { url: "https://vimeo.com/456", thumbnail: "https://example.test/cover.jpg" } },
    { type: "video", data: { url } },
  ] } } }));
  const images = [...html.matchAll(/<img [^>]+>/g)].map(match => match[0]);
  assert.equal(images.length, 3);
  assert.match(images[0], /loading="eager"/);
  assert.match(images[0], /fetchPriority="high"/);
  assert.match(images[0], /hqdefault.jpg/);
  for (const image of images) assert.match(image, /width="480" height="360"/);
  for (const image of images.slice(1)) {
    assert.match(image, /loading="lazy"/);
    assert.doesNotMatch(image, /fetchPriority="high"/);
  }
  assert.equal((html.match(/"name":"Lessons"/g) || []).length, 6);
  assert.doesNotMatch(html, /"description":"Video content"|"name":"Video"/);
});

test("moments heading, titles and time links inherit AA neutral contrast in light and dark themes", async () => {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  for (const darkMode of [false, true]) for (const themeColor of [undefined, "#6366f1", "#ffcc00"]) {
    const html = await renderHtml(createElement(PageRenderer, { page: { slug: "demo", title: "Lesson", template: "APP_LANDING", darkMode, themeColor, content: { sections: [{ type: "video", data: { url, moments: [{ t: 0, title: "Opening" }] } }] } } }));
    const moments = html.slice(html.indexOf('<div class="mt-8 min-w-0"'));
    const foreground = moments.match(/style="color:(#[a-f0-9]{6})"/)![1];
    for (const background of darkMode ? ["#111827", "#1f2937"] : ["#ffffff", "#f9fafb"]) {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
      assert.ok((values[1] + 0.05) / (values[0] + 0.05) >= 4.5);
    }
    assert.doesNotMatch(moments, /<h3[^>]+style=|<a[^>]+style=|<span[^>]+style=/);
  }
});

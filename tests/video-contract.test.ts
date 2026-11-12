import test from "node:test";
import assert from "node:assert/strict";
import { parseVideoUrl, videoEmbedUrl, videoTimeLink } from "../src/lib/video-url.ts";
import { normalizeVideoData, normalizeVideoContent, parseVideoTime, videoDurationSeconds } from "../src/lib/video-data.ts";
import { buildVideoJsonLd } from "../src/lib/video-jsonld.ts";
import { createPageSchema, updatePageSchema } from "../src/lib/validations/page.ts";
import { checkPagePreview } from "../src/lib/page-preview.ts";
import { samePageVideoTime } from "../src/lib/video-navigation.ts";
import { serializeJsonLd } from "../src/lib/json-ld.ts";

const id = "Abc_123-xyz";
const url = `https://www.youtube.com/watch?v=${id}`;

test("strict video URL parsing accepts only the supported provider paths/IDs and HTTPS files", () => {
  for (const input of [url, `https://youtube.com/watch?v=${id}&list=ignored`, `https://m.youtube.com/watch?v=${id}`, `https://youtu.be/${id}`, `https://www.youtube.com/shorts/${id}`, `https://youtube.com/embed/${id}`, `https://youtube-nocookie.com/embed/${id}`, `https://www.youtube-nocookie.com/embed/${id}`, `http://youtube.com/watch?v=${id}`]) {
    const parsed = parseVideoUrl(input);
    assert.deepEqual(parsed, { kind: "youtube", id, url }, input);
    assert.equal(videoEmbedUrl(parsed!), `https://www.youtube-nocookie.com/embed/${id}`);
    assert.equal(videoTimeLink(parsed!, 90), `${url}&t=90s`);
  }
  for (const [input, hash] of [["https://vimeo.com/123456", undefined], ["https://vimeo.com/123456/abc123", "abc123"], ["https://vimeo.com/123456?h=abc123", "abc123"], ["https://player.vimeo.com/video/123456?h=abc123", "abc123"]]) {
    const parsed = parseVideoUrl(input);
    assert.equal(parsed?.kind, "vimeo");
    assert.equal(videoEmbedUrl(parsed!), `https://player.vimeo.com/video/123456${hash ? `?h=${hash}` : ""}`);
    assert.equal(videoTimeLink(parsed!, 90), `https://vimeo.com/123456${hash ? `/${hash}` : ""}#t=90s`);
  }
  const file = "https://media.example.test/film.MP4?quality=high&key=fictional";
  assert.deepEqual(parseVideoUrl(file), { kind: "file", url: file });
  assert.equal(videoTimeLink(parseVideoUrl(file)!, 90), `${file}#t=90`);
  assert.equal(parseVideoUrl("https://media.example.test/film.webm")?.kind, "file");
  assert.equal(parseVideoUrl("https://media.example.test/image.GIF?size=small")?.kind, "gif");
  assert.ok(parseVideoUrl(`https://youtube.com:443/watch?v=${id}`));
  for (const bad of ["", "not a url", `https://youtube.com.evil.test/watch?v=${id}`, `https://youtube.com@evil.test/watch?v=${id}`, `https://user:password@youtube.com/watch?v=${id}`, `https://youtube.com:444/watch?v=${id}`, "https://youtube.com/watch?v=short", `https://youtube.com/watch?v=${id}X`, "https://youtube.com/embed/a%3Fb", "https://youtu.be/Abc_123-xy!", `https://youtube.com/other/${id}`, "https://vimeo.com/name", "https://vimeo.com/123?h=bad%2Fhash", "https://player.vimeo.com/123", "https://vimeo.com.evil.test/123", "http://media.example.test/a.mp4", "https://u:p@media.example.test/a.mp4", "https://media.example.test:8443/a.webm", "https://media.example.test/a.mp4/more", "https://unknown.example.test/player", "https://youtube.com.evil.test/video.mp4", "https://player.vimeo.com.evil.test/video.webm"]) assert.equal(parseVideoUrl(bad), null, bad);
});

test("time parser normalizes integer seconds and clock forms within 24 hours", () => {
  for (const [input, expected] of [[0, 0], [90, 90], ["90", 90], ["1:30", 90], ["01:30", 90], ["1:02:03", 3723], ["24:00:00", 86400], [86400, 86400]] as const) assert.equal(parseVideoTime(input), expected);
  for (const value of [-1, 1.5, Infinity, NaN, "-1", "1:75", "60:00", "1:60:00", "1:00:60", "24:00:01", 86401, "1:2", "1e3", " 90 ", "", null, true]) assert.equal(parseVideoTime(value), null, String(value));
  assert.equal(videoDurationSeconds("PT1H2M3S"), 3723);
  assert.equal(videoDurationSeconds("P1D"), 86400);
  assert.equal(videoDurationSeconds("PT0S"), null);
});

test("moments sort and dedupe stably without mutation; every limit has a precise path", () => {
  const input = { url, startAt: "1:30", moments: [{ t: "1:30", title: "First" }, { t: 0, title: "Opening" }, { t: 90, title: "Discarded duplicate" }] };
  const before = JSON.stringify(input);
  const result = normalizeVideoData(input);
  assert.deepEqual(result.issues, []);
  assert.equal(result.data.startAt, 90);
  assert.deepEqual(result.data.moments, [{ t: 0, title: "Opening" }, { t: 90, title: "First" }]);
  assert.equal(JSON.stringify(input), before);
  assert.equal(normalizeVideoData({ url, moments: Array.from({ length: 100 }, (_, t) => ({ t, title: "Clip" })) }).issues.length, 0);
  for (const [fields, path] of [
    [{ moments: Array.from({ length: 101 }, (_, t) => ({ t, title: "Clip" })) }, "sections[2].data.moments"],
    [{ momentsHeading: "a".repeat(61) }, "sections[2].data.momentsHeading"],
    [{ moments: [{ t: 0, title: "a".repeat(121) }] }, "sections[2].data.moments[0].title"],
    [{ moments: [{ t: 0, title: "Title", text: "a".repeat(601) }] }, "sections[2].data.moments[0].text"],
    [{ moments: [{ t: 0, title: "A" }, { t: 2, title: "B" }, { t: 3, title: "C" }, { t: "1:75", title: "Bad" }] }, "sections[2].data.moments[3].t"],
    [{ startAt: -1 }, "sections[2].data.startAt"],
    [{ thumbnail: "javascript:alert(1)" }, "sections[2].data.thumbnail"],
    [{ uploadDate: "2026-02-31" }, "sections[2].data.uploadDate"],
    [{ duration: "tomorrow" }, "sections[2].data.duration"],
  ] as const) {
    const result = normalizeVideoData({ url, ...fields }, ["sections", 2, "data"]);
    assert.ok(result.issues.some(issue => issue.message.startsWith(`${path}:`)), path);
  }
  assert.equal(normalizeVideoData({ url, momentsHeading: "a".repeat(60), moments: [{ t: 1, title: "a".repeat(120), text: "a".repeat(600) }] }).issues.length, 0);
  assert.ok(normalizeVideoData({ url: "https://example.test/animated.gif", moments: [] }).issues.length);
});

test("create/update schemas and preview use the same normalization and errors", () => {
  const content = { sections: [{ type: "about", data: {} }, { type: "video", data: { url, moments: [{ t: "1:75", title: "Broken" }] } }] };
  const body = { slug: "fictional-demo", title: "Fictional demo", content };
  const preview = checkPagePreview(body);
  assert.equal(preview.valid, false);
  assert.match(preview.errors[0].message, /sections\[1\]\.data\.moments\[0\]\.t/);
  for (const schema of [createPageSchema, updatePageSchema]) {
    const result = schema.safeParse(body);
    assert.equal(result.success, false);
    if (!result.success) assert.deepEqual(result.error.issues[0].path, ["content", "sections", 1, "data", "moments", 0, "t"]);
  }
  const valid = checkPagePreview({ ...body, content: { sections: [{ type: "video", data: { url, moments: [{ t: "1:30", title: "Clip" }] } }] } });
  assert.equal(valid.valid, true);
  assert.equal((valid.sanitizedContent?.sections as { data: { moments: { t: number }[] } }[])[0].data.moments[0].t, 90);
  assert.equal(normalizeVideoContent(content).issues.length, 1);
});

test("VideoObject has ordered Clips, real metadata, page-specific seek URLs and no invented dates", () => {
  const video = parseVideoUrl(url)!;
  const data = { url, moments: [{ t: 90, title: "Second" }, { t: 0, title: "First" }] };
  const schema = buildVideoJsonLd(data, video, "https://appai.info/p/fictional/ja/lesson", "intro-video");
  assert.deepEqual(schema.hasPart, [
    { "@type": "Clip", name: "First", startOffset: 0, endOffset: 90, url: "https://appai.info/p/fictional/ja/lesson?t=0#intro-video" },
    { "@type": "Clip", name: "Second", startOffset: 90, url: "https://appai.info/p/fictional/ja/lesson?t=90#intro-video" },
  ]);
  assert.equal(schema.thumbnailUrl, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  for (const key of ["uploadDate", "duration", "contentUrl"]) assert.equal(Object.hasOwn(schema, key), false);
  const supplied = buildVideoJsonLd({ ...data, uploadDate: "2025-02-01T12:00:00Z", duration: "PT2M", thumbnail: "https://example.test/cover.jpg" }, video, "https://appai.info/p/fictional", "intro");
  assert.equal(supplied.uploadDate, "2025-02-01T12:00:00Z");
  assert.equal(supplied.duration, "PT2M");
  assert.equal((supplied.hasPart as { endOffset: number }[])[1].endOffset, 120);
  assert.equal(supplied.thumbnailUrl, "https://example.test/cover.jpg");
  const vimeo = buildVideoJsonLd({ url: "https://vimeo.com/123" }, parseVideoUrl("https://vimeo.com/123")!, "https://appai.info/p/fictional", "v");
  assert.equal(Object.hasOwn(vimeo, "thumbnailUrl"), false);
  const xss = buildVideoJsonLd({ url, moments: [{ t: 0, title: '</script><script>alert("x")</script>' }] }, video, "https://appai.info/p/fictional", "v");
  assert.doesNotMatch(serializeJsonLd(xss), /<script|<\/script/);
});

test("share URL matching ignores foreign documents, malformed times and unrelated query navigation", () => {
  const current = "https://appai.info/p/fictional?view=full";
  assert.equal(samePageVideoTime("?t=90#intro-video", current)?.id, "intro-video");
  assert.equal(samePageVideoTime("?t=90#intro-video", current)?.t, 90);
  for (const href of ["https://evil.test/p/fictional?t=90", "/p/other?t=90", "?t=-1", "?t=1:75", "?t=90&view=other", "#intro-video", "?t=90#%GG"]) assert.equal(samePageVideoTime(href, current), null, href);
});

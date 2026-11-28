import test from "node:test";
import assert from "node:assert/strict";
import {
  backendEndpoint,
  categoryLabel,
  configuredBackendBase,
  fetchSearch,
  fetchStats,
  fetchVideos,
  isHttpsBackendUrl,
  normalizeCustomBackend,
  parseSearchResponse,
  parseStatsResponse,
  parseStoredBackends,
  parseVideosResponse,
  VIDEO_ASK_ALLOW_DIRECT_BACKENDS,
  videoAskContentIssues,
  youtubeEmbedUrl,
} from "../src/lib/video-ask.ts";
import { getConnector } from "../src/lib/connectors/registry.ts";
import { ipSalt, quotaSubject, quotaWhere } from "../src/lib/connectors/quota.ts";
import { createPageSchema } from "../src/lib/validations/page.ts";
import { getSectionDef } from "../src/lib/template-registry.ts";
import { videoAskStrings } from "../src/templates/sections/video-ask-strings.ts";

const content = (data: unknown) => ({ sections: [{ type: "about", data: { text: "x" } }, { type: "video-ask", data }] });
// Browser-direct backends are behind an owner flag (default off); most
// contract tests exercise the enabled path explicitly.
const issues = (data: unknown) => videoAskContentIssues(content(data), true);
const issuesDefault = (data: unknown) => videoAskContentIssues(content(data));

test("video-ask section: valid configurations pass", () => {
  for (const data of [
    { connector: "video-ask-gta6" },
    { connector: "video-ask-gta6", mode: "inline", heading: "Ask", intro: "Hi", allowCustomBackend: true, placeholder: "Ask…", disclaimer: "Fan project" },
    { backendUrl: "https://videos.example.com/api", mode: "floating" },
    { backendUrl: "https://videos.example.com", allowCustomBackend: false, id: "ask", backgroundColor: "#fff" },
  ]) assert.deepEqual(issues(data), [], JSON.stringify(data));
});

test("video-ask section: rejects bad backends, modes and missing config with sectioned paths", () => {
  const cases: [unknown, RegExp][] = [
    [{}, /sections\[1\]\.data\.connector: set connector/],
    [{ connector: "video-ask-gta6", backendUrl: "https://x.test" }, /data\.backendUrl: set either/],
    [{ connector: "nope-not-registered" }, /unknown connector/],
    [{ connector: "Bad Name" }, /data\.connector/],
    [{ backendUrl: "http://x.test" }, /data\.backendUrl: backendUrl must be an https/],
    [{ backendUrl: "javascript:alert(1)" }, /data\.backendUrl/],
    [{ backendUrl: "/api/connect/video-ask-gta6" }, /data\.backendUrl/],
    [{ backendUrl: "https://user:pw@x.test" }, /data\.backendUrl/],
    [{ connector: "video-ask-gta6", mode: "popup" }, /data\.mode/],
    [{ connector: "video-ask-gta6", allowCustomBackend: "yes" }, /data\.allowCustomBackend/],
    [{ connector: "video-ask-gta6", heading: "x".repeat(121) }, /data\.heading/],
  ];
  for (const [data, pattern] of cases) {
    const found = issues(data);
    assert.ok(found.length > 0, JSON.stringify(data));
    assert.ok(found.some(issue => pattern.test(issue.message)), `${JSON.stringify(data)} → ${found.map(i => i.message).join(" | ")}`);
  }
});

test("video-ask section: browser-direct backends are off by default", () => {
  assert.equal(VIDEO_ASK_ALLOW_DIRECT_BACKENDS, false);
  assert.deepEqual(issuesDefault({ connector: "video-ask-gta6", allowCustomBackend: true }), []);
  assert.match(issuesDefault({ backendUrl: "https://videos.example.com" })[0].message, /data\.backendUrl: backendUrl is not enabled/);
  assert.match(issuesDefault({})[0].message, /set connector \(an owner-registered connector name\)$/);
  assert.equal(configuredBackendBase({ backendUrl: "https://x.test/api" }), null);
  assert.equal(configuredBackendBase({ connector: "video-ask-gta6" }), "/api/connect/video-ask-gta6");
});

test("video-ask section: page validator wires the section issues in", () => {
  const ok = createPageSchema.safeParse({ slug: "gta-ask", title: "GTA", content: content({ connector: "video-ask-gta6" }) });
  assert.equal(ok.success, true);
  for (const data of [{ backendUrl: "http://insecure.test" }, { backendUrl: "https://videos.example.com" }]) {
    const bad = createPageSchema.safeParse({ slug: "gta-ask", title: "GTA", content: content(data) });
    assert.equal(bad.success, false, JSON.stringify(data));
  }
  assert.ok(getSectionDef("video-ask"), "registered in SECTION_DEFS");
});

test("video-ask connector: allowPaths only search|stats|videos, only POST search is billed", () => {
  const c = getConnector("video-ask-gta6")!;
  assert.ok(c);
  assert.equal(c.gating, "public");
  assert.equal(c.auth, "server-token");
  assert.equal(c.baseUrlEnv, "VIDEO_ASK_GTA6_URL");
  assert.equal(c.secretEnv, "VIDEO_ASK_GTA6_TOKEN");
  assert.deepEqual(c.quota, { per: "ip", limit: 30, window: "1h", countActions: ["search"] });
  for (const path of ["search", "stats", "videos"]) assert.ok(c.allowPaths.test(path), path);
  for (const path of ["", "search/", "searchx", "admin", "videos/1", "../search", "stats?x", "jobs", "search/../admin"]) assert.ok(!c.allowPaths.test(path), path);
  assert.equal(c.usageAction!("POST", "search", { q: "x" }), "search");
  assert.equal(c.usageAction!("GET", "stats", null), null);
  assert.equal(c.usageAction!("GET", "videos", null), null);
});

test("connector quota: per-IP quotas are scoped to a hashed IP, not global", () => {
  const a = quotaSubject("ip", null, "203.0.113.5, 10.0.0.1");
  const b = quotaSubject("ip", null, "198.51.100.7");
  assert.notEqual(a, b);
  assert.equal(a, quotaSubject("ip", "user-1", "203.0.113.5"));
  // Keyed by a server secret, so a public constant cannot reverse IPv4 hashes.
  assert.notEqual(quotaSubject("ip", null, "203.0.113.5", "salt-one"), quotaSubject("ip", null, "203.0.113.5", "salt-two"));
  assert.equal(ipSalt({ CONNECTOR_IP_SALT: "c", AUTH_SECRET: "a" }), "c");
  assert.equal(ipSalt({ AUTH_SECRET: "a" }), "a");
  const random = ipSalt({});
  assert.ok(random.length >= 32);
  assert.equal(ipSalt({}), random, "stable per process");
  assert.ok(!a!.includes("203.0.113.5"));
  assert.equal(quotaSubject("user", "user-1", "203.0.113.5"), "user-1");
  const since = new Date(0);
  const quota = getConnector("video-ask-gta6")!.quota!;
  assert.deepEqual(quotaWhere("video-ask-gta6", quota, a!, since), {
    connector: "video-ask-gta6", meta: { path: ["ip"], equals: a }, action: { in: ["search"] }, createdAt: { gte: since },
  });
  const userQuota = getConnector("video-subtitle")!.quota!;
  assert.deepEqual(quotaWhere("video-subtitle", userQuota, "u1", since), {
    connector: "video-subtitle", userId: "u1", action: { in: ["job.transcribe"] }, createdAt: { gte: since },
  });
});

const item = { videoId: "M7lc1UVf-VE", title: "T", author: "A", language: "en", summary: "S", category: { code: "map", label: "Map" }, embeddable: true };

test("response parsing: well-formed search/stats/videos", () => {
  const search = parseSearchResponse({ results: [item, { ...item, videoId: "aqz-KE-bpKQ", thumbnail: "https://img.example/x.jpg", embeddable: false }], answer: null })!;
  assert.equal(search.results.length, 2);
  assert.equal(search.results[0].thumbnail, "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg");
  assert.equal(search.results[1].thumbnail, "https://img.example/x.jpg");
  assert.equal(search.results[1].embeddable, false);
  const stats = parseStatsResponse({ totalVideos: 10, indexedVideos: 8, updatedAt: "2026-11-27", categories: [{ code: "map", label: { en: "Map", "zh-TW": "地圖" }, count: 3 }] })!;
  assert.equal(stats.totalVideos, 10);
  assert.equal(categoryLabel(stats.categories[0].label, "zh-TW"), "地圖");
  assert.equal(categoryLabel(stats.categories[0].label, "zh-CN"), "地圖");
  assert.equal(categoryLabel(stats.categories[0].label, "es"), "Map");
  const page = parseVideosResponse({ results: [item], page: 2, hasMore: true })!;
  assert.deepEqual([page.results.length, page.page, page.hasMore], [1, 2, true]);
});

test("response parsing: malformed backend JSON never throws and degrades", () => {
  const junk: unknown[] = [null, undefined, 42, "x", [], [1, 2], { results: "nope" }, { results: null }, { results: {} }, { totalVideos: "many" }, { categories: "x" }, { results: [null, 1, "x", {}, { videoId: "bad id!!", title: "x" }, { videoId: "M7lc1UVf-VE" }] }];
  for (const value of junk) {
    assert.doesNotThrow(() => parseSearchResponse(value));
    assert.doesNotThrow(() => parseStatsResponse(value));
    assert.doesNotThrow(() => parseVideosResponse(value));
  }
  assert.equal(parseSearchResponse({ results: "nope" }), null);
  assert.equal(parseStatsResponse({ totalVideos: "many" }), null);
  assert.deepEqual(parseSearchResponse({ results: [null, 1, { videoId: "bad id!!", title: "x" }, { videoId: "M7lc1UVf-VE" }] }), { results: [] });
  // Unsafe thumbnails fall back; missing embeddable means link only; dupes and overflow trimmed.
  const parsed = parseSearchResponse({ results: [
    { ...item, thumbnail: "javascript:alert(1)", embeddable: "yes" },
    item,
    ...["aqz-KE-bpKQ", "jNQXAC9IVRw", "eRsGyueVLvQ", "R6MlUcmOul8", "YE7VzlLtp-4"].map(videoId => ({ ...item, videoId })),
  ] })!;
  assert.equal(parsed.results.length, 5);
  assert.equal(parsed.results[0].thumbnail, "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg");
  assert.equal(parsed.results[0].embeddable, false);
  assert.equal(parseStatsResponse({ categories: [{ code: "", count: 1 }, { code: "x", label: 5, count: -1 }] })!.categories[0].count, null);
});

test("fetch helpers: errors and malformed bodies reject (UI shows paused), good bodies resolve", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const respond = (body: unknown, status = 200) => async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  const ok = await fetchSearch("https://v.example/api/", "map size", "zh-TW", respond({ results: [item], answer: null }));
  assert.equal(ok.results.length, 1);
  assert.equal(calls[0].url, "https://v.example/api/search");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { q: "map size", lang: "zh-TW" });
  assert.equal(calls[0].init?.credentials, "omit");
  await assert.rejects(fetchSearch("https://v.example", "q", undefined, respond({ error: "x" }, 503)));
  await assert.rejects(fetchSearch("https://v.example", "q", undefined, respond("<html>not json")));
  await assert.rejects(fetchStats("https://v.example", respond(["x"])));
  // /stats: 404 = not offered (search box only); 5xx/network/timeout/malformed = paused.
  assert.equal(await fetchStats("https://v.example", respond({ title: "Not Found" }, 404)), null);
  await assert.rejects(fetchStats("https://v.example", respond({}, 503)));
  await assert.rejects(fetchStats("https://v.example", respond("<html>")));
  await assert.rejects(fetchStats("https://v.example", async () => { throw new TypeError("network"); }));
  await assert.rejects(fetchSearch("https://v.example", "q", undefined, async () => { throw new TypeError("network"); }));
  await fetchVideos("/api/connect/video-ask-gta6", "map & more", 2, respond({ results: [], page: 2, hasMore: false }));
  assert.equal(calls.at(-1)!.url, "/api/connect/video-ask-gta6/videos?category=map+%26+more&page=2");
});

test("backend base + visitor-added backends: https only, stored list sanitised", () => {
  assert.equal(configuredBackendBase({ connector: "video-ask-gta6" }), "/api/connect/video-ask-gta6");
  assert.equal(configuredBackendBase({ backendUrl: "https://x.test/api" }, true), "https://x.test/api");
  assert.equal(configuredBackendBase({ backendUrl: "http://x.test" }, true), null);
  assert.equal(configuredBackendBase({ backendUrl: "//evil.test" }, true), null);
  assert.equal(backendEndpoint("https://x.test/api//", "stats"), "https://x.test/api/stats");
  for (const bad of ["", "http://x.test", "ftp://x.test", "javascript:alert(1)", "https://", "https://u:p@x.test", "https://x .test", "x.test"]) {
    assert.equal(isHttpsBackendUrl(bad), false, bad);
    assert.equal(normalizeCustomBackend(bad), null, bad);
  }
  assert.equal(normalizeCustomBackend("  https://x.test/api/  "), "https://x.test/api");
  assert.deepEqual(parseStoredBackends('["https://a.test","http://b.test","https://a.test",5,"https://c.test"]'), ["https://a.test", "https://c.test"]);
  assert.deepEqual(parseStoredBackends("{broken"), []);
  assert.deepEqual(parseStoredBackends(null), []);
});

test("embeds use youtube-nocookie from the start; UI strings exist for D41 locales", () => {
  const url = youtubeEmbedUrl("M7lc1UVf-VE");
  assert.match(url, /^https:\/\/www\.youtube-nocookie\.com\/embed\/M7lc1UVf-VE\?/);
  assert.doesNotMatch(url, /[?&](start|t)=/);
  const en = videoAskStrings("en");
  for (const locale of ["zh-TW", "zh-CN", "es"]) {
    const s = videoAskStrings(locale);
    assert.notEqual(s.paused, en.paused, locale);
    const keys = (o: object) => Object.keys(o).filter(k => k !== "locale" && k !== "isDefault").sort();
    assert.deepEqual(keys(s), keys(en), locale);
  }
  assert.equal(videoAskStrings("fr").paused, en.paused);
});

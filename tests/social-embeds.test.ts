import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
const hooks = registerHostedRenderLoader();
const { detectProvider, buildEmbed, EmbedSection } = await import("../src/templates/sections/EmbedSection.tsx");
const { ContactSection, SOCIAL_ICONS, SOCIAL_NAMES } = await import("../src/templates/sections/ContactSection.tsx");
const { SOCIAL_PLATFORMS } = await import("../src/lib/sanitize.ts");
const { ICON_PATHS } = await import("../src/components/ui/icon-data.ts");

test("every social enum platform has a distinct bundled icon and platform label", () => {
  assert.equal(new Set(Object.values(SOCIAL_ICONS)).size, SOCIAL_PLATFORMS.length);
  for (const platform of SOCIAL_PLATFORMS) {
    const icon = SOCIAL_ICONS[platform];
    assert.ok(ICON_PATHS[icon], platform);
    assert.notEqual(icon, "chatbubble-outline");
    for (const label of [undefined, "Message us"]) {
      const html = renderToStaticMarkup(createElement(ContactSection, { themeColor: "#123456", data: { socials: [{ platform, url: "https://example.com", label }] } }));
      assert.ok(html.includes(SOCIAL_NAMES[platform]));
      assert.ok(html.includes(ICON_PATHS[icon]));
    }
  }
});

const cases = [
  ["https://www.facebook.com/example/posts/pfbidABC123", "facebook", "post.php"],
  ["https://facebook.com/example/videos/123456/", "facebook", "video.php"],
  ["https://www.facebook.com/watch/?v=123456", "facebook", "video.php"],
  ["https://www.facebook.com/video.php?v=123456", "facebook", "video.php"],
  ["https://www.facebook.com/permalink.php?story_fbid=123&id=456", "facebook", "post.php"],
  ["https://www.facebook.com/reel/123456", "facebook", "video.php"],
  ["https://www.threads.net/@example/post/AbC_123-", "threads", ""],
  ["https://www.threads.com/@example/post/AbC123/", "threads", ""],
  ["https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share", "youtube", "embed/dQw4w9WgXcQ"],
] as const;

test("official social URLs parse and render the correct embed", () => {
  for (const [url, kind, suffix] of cases) {
    const provider = detectProvider(url);
    assert.equal(provider?.kind, kind, url);
    const html = renderToStaticMarkup(createElement(EmbedSection, { themeColor: "#123456", data: { url } }));
    if (kind === "threads") {
      assert.match(buildEmbed(provider!).src, /^https:\/\/www\.threads\.com\/@example\/post\/AbC[_a-zA-Z0-9-]*\/embed$/);
      assert.doesNotMatch(html, /<script|blockquote|embed\.js/);
    }
    const src = buildEmbed(provider!).src;
    assert.ok(src.includes(suffix));
    if (kind === "facebook") assert.equal(new URL(src).searchParams.get("href"), provider && "url" in provider ? provider.url : "");
    assert.match(html, /loading="lazy"/);
    assert.match(html, /sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"/);
  }
});

test("social embeds reject unsafe schemes, misleading hosts and malformed posts", () => {
  for (const [url] of cases) {
    assert.equal(detectProvider(`javascript:${url}`), null);
    const parsed = new URL(url);
    for (const bad of [`https://evil.example${parsed.pathname}${parsed.search}`, `https://${parsed.hostname}.evil.example${parsed.pathname}`, url.replace("https://", "https://user:pass@")]) {
      // Legacy substring matches remain supported; new provider patterns validate hosts.
      if (!oldDetectProvider(bad)) assert.equal(detectProvider(bad), null, bad);
    }
  }
  for (const bad of ["https://www.facebook.com/example", "https://www.threads.net/@example", "https://youtube.com/shorts/short", "https://youtube.com/shorts/dQw4w9WgXcQEXTRA", "https://threads.net/@user/post/id/extra"]) assert.equal(detectProvider(bad), null, bad);
});

test.after(() => hooks.deregister());

// Reference copied from origin/main:src/templates/sections/EmbedSection.tsx.
function oldDetectProvider(rawUrl: string) {
  const url = rawUrl.trim();

  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { kind: "youtube", id: yt[1] };

  const vi = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vi) return { kind: "vimeo", id: vi[1] };

  const tt = url.match(/tiktok\.com\/@([^/]+)\/video\/(\d+)/);
  if (tt) return { kind: "tiktok", user: tt[1], id: tt[2] };

  const lm = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (lm) return { kind: "loom", id: lm[1] };

  if (/(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+/.test(url)) {
    return { kind: "twitter", url };
  }

  if (/instagram\.com\/(?:p|reel)\/[a-zA-Z0-9_-]+/.test(url)) {
    return { kind: "instagram", url };
  }

  const sp = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (sp) return { kind: "spotify", path: `${sp[1]}/${sp[2]}` };

  const cp = url.match(/codepen\.io\/([^/]+)\/(?:pen|details)\/([a-zA-Z0-9]+)/);
  if (cp) return { kind: "codepen", user: cp[1], id: cp[2] };

  if (/figma\.com\/(?:file|proto|design|board|community\/file)\//.test(url)) {
    return { kind: "figma", url };
  }

  return null;
}


const legacyUrls = [
  "https://youtube.com/watch?v=dQw4w9WgXcQ", "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://m.youtube.com/watch?v=dQw4w9WgXcQ", "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ?t=10", "https://youtube.com/embed/dQw4w9WgXcQ/trailing",
  "https://youtube.com/watch?v=dQw4w9WgXcQEXTRA", "https://player.vimeo.com/video/12345",
  "https://vimeo.com/12345/trailing", "https://m.tiktok.com/@user/video/12345",
  "https://www.loom.com/share/abc123?sid=1", "https://x.com/user/status/12345",
  "https://mobile.twitter.com/user/status/12345", "https://instagram.com/p/Ab_C-123/",
  "https://instagram.com/reel/Ab_C-123/", "https://open.spotify.com/track/abc123",
  "https://open.spotify.com/album/abc123", "https://open.spotify.com/playlist/abc123",
  "https://open.spotify.com/episode/abc123", "https://open.spotify.com/show/abc123",
  "https://codepen.io/user/pen/abc123", "https://codepen.io/user/details/abc123",
  ...["file", "proto", "design", "board", "community/file"].map(path => `https://figma.com/${path}/abc123`),
  "https://example.com/youtube.com/watch?v=dQw4w9WgXcQ",
  "https://example.com/?url=https://vimeo.com/12345",
  "//youtube.com/embed/dQw4w9WgXcQ", "/youtube.com/embed/dQw4w9WgXcQ",
];

test("every legacy URL retains its provider and video/post identity", () => {
  for (const original of legacyUrls) {
    for (const url of [original, original.replace(/^https:/, "http:")]) {
      const previous = oldDetectProvider(url);
      assert.ok(previous, url);
      // Only the scheme is upgraded; IDs, users, paths and post URLs remain intact.
      const expected = typeof previous.url === "string" ? { ...previous, url: previous.url.replace(/^http:/i, "https:") } : previous;
      assert.deepEqual(detectProvider(url), expected, url);
    }
  }
});

test("YouTube privacy embeds and HTTP social URLs use HTTPS iframes", () => {
  assert.deepEqual(detectProvider("http://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"), { kind: "youtube", id: "dQw4w9WgXcQ" });
  for (const [url] of cases) {
    const provider = detectProvider(url.replace("https:", "http:"));
    assert.ok(provider, url);
    assert.ok(buildEmbed(provider).src.startsWith("https://"), url);
  }
});

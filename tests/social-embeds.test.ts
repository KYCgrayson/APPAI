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
      assert.match(html, /class="text-post-media"/);
      assert.match(html, /data-text-post-permalink="https:\/\/www.threads.com\//);
    } else {
      const src = buildEmbed(provider!).src;
      assert.ok(src.includes(suffix));
      if (kind === "facebook") assert.equal(new URL(src).searchParams.get("href"), provider && "url" in provider ? provider.url : "");
      assert.match(html, /loading="lazy"/);
      assert.match(html, /sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"/);
    }
  }
});

test("social embeds reject unsafe schemes, misleading hosts and malformed posts", () => {
  for (const [url] of cases) {
    const parsed = new URL(url);
    for (const bad of [url.replace("https:", "http:"), `javascript:${url}`, `https://evil.example${parsed.pathname}${parsed.search}`, `https://${parsed.hostname}.evil.example${parsed.pathname}`, `https://evil.example/?url=${url}`, url.replace("https://", "https://user:pass@")]) {
      assert.equal(detectProvider(bad), null, bad);
    }
  }
  for (const bad of ["https://www.facebook.com/example", "https://www.threads.net/@example", "https://youtube.com/shorts/short", "https://youtube.com/shorts/dQw4w9WgXcQEXTRA", "https://threads.net/@user/post/id/extra"]) assert.equal(detectProvider(bad), null, bad);
});

test.after(() => hooks.deregister());

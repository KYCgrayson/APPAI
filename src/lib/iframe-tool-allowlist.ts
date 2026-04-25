/**
 * Origin allowlist for the `iframe-tool` section.
 *
 * Only iframes whose hostname matches one of these patterns will render. Anything
 * else falls through to a friendly error block on the page. Goal: vibe-coders
 * can publish their tool from a free deploy host (Vercel / Cloudflare Pages /
 * Netlify / GitHub Pages) without giving the platform a phishing surface.
 *
 * Patterns:
 *   "*.vercel.app"  → matches any subdomain of vercel.app (depth >= 1)
 *   "example.com"   → matches that exact host only
 */
export const IFRAME_TOOL_ALLOWLIST: readonly string[] = [
  "*.vercel.app",
  "*.pages.dev",
  "*.netlify.app",
  "*.github.io",
];

export interface IframeUrlCheckResult {
  ok: boolean;
  reason?: string;
  url?: URL;
}

export function checkIframeToolUrl(
  raw: string,
  allowlist: readonly string[] = IFRAME_TOOL_ALLOWLIST,
): IframeUrlCheckResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "URL must use https://" };
  }
  const host = url.hostname.toLowerCase();
  for (const pattern of allowlist) {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      if (host.endsWith(suffix) && host.length > suffix.length) {
        return { ok: true, url };
      }
    } else if (host === pattern.toLowerCase()) {
      return { ok: true, url };
    }
  }
  return {
    ok: false,
    reason: `Host "${host}" is not in the iframe-tool allowlist. Allowed: ${allowlist.join(", ")}`,
    url,
  };
}

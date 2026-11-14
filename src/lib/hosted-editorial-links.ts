import { parseVideoTime, VIDEO_TIME_PATTERN } from "./video-data.ts";

const anchor = "#[a-zA-Z][\\w-]*";
const time = VIDEO_TIME_PATTERN.slice(1, -1);
// URL() still checks host/IPv6 semantics; this shared schema pattern also rejects
// empty authorities, credentials and nonnumeric/out-of-range ports.
const authority = "(?:\\[[0-9a-fA-F:.]+\\]|[^\\s/?#:@<>\\[\\]\\\\]+)(?::(?:[0-9]{1,4}|[0-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?";
// The stricter card policy shares parsing and external-link behavior with prose.
export const PROJECT_CARD_HREF_PATTERN = `^(?!.*[\\s<>\\\\])(?:https://${authority}(?:[/?#].*)?|/p/[a-zA-Z0-9-]+(?:/[a-zA-Z0-9-]+)*/?(?:\\?t=${time})?(?:${anchor})?|${anchor}|\\?t=${time}${anchor})$`;
export const EDITORIAL_IMAGE_PATTERN = `^https://${authority}(?:[/?#][^\\s<>\\\\]*)?$`;

export function editorialImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !new RegExp(EDITORIAL_IMAGE_PATTERN).test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

/** Link policy for publisher-supplied editorial content. Invalid links are omitted. */
export function editorialLink(href: string | undefined, origin: string, policy: "editorial" | "project-card" = "editorial") {
  if (typeof href !== "string" || !href || href === "#" || /^(mailto:|tel:)/i.test(href)) return undefined;
  if (policy === "project-card" && (href.length > 2048 || !new RegExp(PROJECT_CARD_HREF_PATTERN).test(href))) return undefined;
  const videoTime = href.match(/^\?t=([0-9:]+)(?:#[^\s]*)?$/);
  if (videoTime && parseVideoTime(videoTime[1]) !== null) return { href, external: false };
  if (/^#[a-zA-Z][\w-]*$/.test(href)) return { href, external: false };
  if (/^\/(?![\/\\])/.test(href)) return { href, external: false };
  try {
    const url = new URL(href);
    const sameOrigin = url.origin === new URL(origin).origin;
    if (policy === "project-card" && (url.protocol !== "https:" || url.username || url.password)) return undefined;
    if (url.protocol !== "https:" && !(sameOrigin && url.protocol === "http:")) return undefined;
    return { href, external: !sameOrigin };
  } catch {
    return undefined;
  }
}

/** Resolve card links for non-DOM consumers, including same-page seek/anchor URLs. */
export function projectCardUrl(value: unknown, pageUrl: string): string | undefined {
  const link = editorialLink(typeof value === "string" ? value : undefined, pageUrl, "project-card");
  if (!link) return undefined;
  try { return new URL(link.href, pageUrl).href; } catch { return undefined; }
}

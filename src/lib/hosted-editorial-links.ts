/** Link policy for publisher-supplied editorial content. Invalid links are omitted. */
export function editorialLink(href: string | undefined, origin: string) {
  if (typeof href !== "string" || !href || href === "#" || /^(mailto:|tel:)/i.test(href)) return undefined;
  if (/^#[a-zA-Z][\w-]*$/.test(href)) return { href, external: false };
  if (/^\/(?![\/\\])/.test(href)) return { href, external: false };
  try {
    const url = new URL(href);
    const sameOrigin = url.origin === new URL(origin).origin;
    if (url.protocol !== "https:" && !(sameOrigin && url.protocol === "http:")) return undefined;
    return { href, external: !sameOrigin };
  } catch {
    return undefined;
  }
}

import { PLATFORM_ORIGIN } from "./platform-identity.ts";
/* Publisher JSON is intentionally open; all SEO URLs pass the shared sanitizer. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { sanitizeUrl } from "./sanitize.ts";
function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`#]/g, "").trim() : "";
}
export function safeHttpUrl(value: unknown, baseUrl?: string): string | undefined {
  if (typeof value !== "string" || sanitizeUrl(value) === "#") return undefined;
  try {
    const url = baseUrl && /^\/p\//.test(value) ? new URL(value, baseUrl) : new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}
export function hostedOgImage(page: any): string | undefined {
  const sections = page.content?.sections || [];
  const profile = sections.find((s: any) => s.type === "profile-header")?.data;
  const project = sections.filter((s: any) => s.type === "project-cards").flatMap((s: any) => s.data?.items || []).find((item: any) => safeHttpUrl(item?.screenshot?.url) || safeHttpUrl(item?.icon?.url));
  const screenshot = sections.find((s: any) => s.type === "screenshots")?.data?.images?.[0];
  return [page.ogImage, page.heroImage, profile?.avatar?.url, project?.screenshot?.url, project?.icon?.url,
    typeof screenshot === "string" ? screenshot : screenshot?.url].map(value => safeHttpUrl(value)).find(Boolean);
}

export function buildJsonLd(
  page: any,
  url: string,
  baseUrl: string,
  breadcrumb: Record<string, unknown> | null,
) {
  const content = page.content as any;
  const downloadSection = content?.sections?.find((s: any) => s.type === "download");
  const platforms: string[] = [];
  if (downloadSection?.data?.appStoreUrl) platforms.push("iOS");
  if (downloadSection?.data?.playStoreUrl) platforms.push("Android");

  const primary: Record<string, any> = {
    "@type": downloadSection ? "SoftwareApplication" : "WebPage",
    "@id": `${url}#primary`,
    name: page.title,
    headline: page.title,
    description: page.metaDescription || page.tagline || undefined,
    url,
    image: hostedOgImage(page),
    inLanguage: page.locale,
    datePublished: page.createdAt ? new Date(page.createdAt).toISOString() : undefined,
    dateModified: page.updatedAt ? new Date(page.updatedAt).toISOString() : undefined,
    isPartOf: { "@id": `${PLATFORM_ORIGIN}/#website` },
    publisher: { "@id": `${PLATFORM_ORIGIN}/#org` },
  };

  const profile = content?.sections?.find((s: any) => s.type === "profile-header")?.data || {};
  const personName = clean(profile.name);
  if (page.template === "PERSON" && !page.parentSlug && personName) {
    primary["@type"] = "ProfilePage";
    const sameAs = (Array.isArray(profile.links) ? profile.links : []).map((link: any) => safeHttpUrl(link?.url)).filter((url: string | undefined) => url?.startsWith("https:"));
    primary.mainEntity = {
      "@type": "Person",
      name: personName,
      ...(clean(profile.tagline || profile.intro) ? { description: clean(profile.tagline || profile.intro) } : {}),
      ...(safeHttpUrl(profile.avatar?.url) ? { image: safeHttpUrl(profile.avatar.url) } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    };
  } else if (downloadSection) {
    primary.applicationCategory = "Application";
    if (platforms.length > 0) primary.operatingSystem = platforms.join(", ");
    primary.offers = { "@type": "Offer", price: "0", priceCurrency: "USD" };
  }

  const graph: any[] = [primary];
  if (breadcrumb) graph.push(breadcrumb);
  for (const section of (content?.sections || []).filter((s: any) => s.type === "project-cards").slice(0, 20)) {
    const items = (Array.isArray(section.data?.items) ? section.data.items : []).slice(0, 100).flatMap((item: any) => {
      const itemUrl = safeHttpUrl(item?.links?.[0]?.url, baseUrl);
      if (!itemUrl || !clean(item?.name)) return [];
      const image = safeHttpUrl(item.icon?.url) || safeHttpUrl(item.screenshot?.url);
      return [{ "@type": "ListItem", name: clean(item.name), url: itemUrl,
        ...(clean(item.description) ? { description: clean(item.description) } : {}), ...(image ? { image } : {}) }];
    }).map((item: any, i: number) => ({ ...item, position: i + 1 }));
    if (items.length) graph.push({ "@type": "ItemList", itemListElement: items });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}


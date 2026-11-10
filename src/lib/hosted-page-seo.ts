import { gameSectionSchema } from "./game-section.ts";
import { DAYS, isBusinessHours, type BusinessHours } from "./business-hours.ts";
import { normalizeHostedContent } from "./hosted-content.ts";
import { PLATFORM_ORIGIN } from "./platform-identity.ts";
/* Publisher JSON is intentionally open; all SEO URLs pass the shared sanitizer. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { sanitizeUrl } from "./sanitize.ts";
function isoDate(value: unknown): string | undefined {
  if (!(typeof value === "string" || typeof value === "number" || value instanceof Date)) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
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
  const sections: any[] = normalizeHostedContent(page.content).sections;
  const profile = sections.find((s: any) => s.type === "profile-header")?.data;
  const project = sections.filter((s: any) => s.type === "project-cards").flatMap((s: any) => s.data?.items || []).find((item: any) => safeHttpUrl(item?.screenshot?.url) || safeHttpUrl(item?.icon?.url));
  const game = sections.find((s: any) => s.type === "game")?.data;
  const screenshot = sections.find((s: any) => s.type === "screenshots")?.data?.images?.[0];
  return [page.ogImage, page.heroImage, page.template === "GAME" ? game?.cover?.url : undefined, profile?.avatar?.url, project?.screenshot?.url, project?.icon?.url,
    typeof screenshot === "string" ? screenshot : screenshot?.url, game?.cover?.url].map(value => safeHttpUrl(value)).find(Boolean);
}

export function buildJsonLd(
  page: any,
  url: string,
  baseUrl: string,
  breadcrumb: Record<string, unknown> | null,
) {
  const content = normalizeHostedContent(page.content) as any;
  const games = content.sections.filter((s: any) => s.type === "game").flatMap((s: any) => { const parsed = gameSectionSchema.safeParse(s.data); return parsed.success ? [parsed.data] : []; });
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
    datePublished: isoDate(page.createdAt),
    dateModified: isoDate(page.updatedAt),
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
  } else if (downloadSection && !games.length) {
    primary.applicationCategory = "Application";
    if (platforms.length > 0) primary.operatingSystem = platforms.join(", ");
    primary.offers = { "@type": "Offer", price: "0", priceCurrency: "USD" };
  }

  const graph: any[] = [primary];
  games.forEach((game: any, index: number) => {
    const videoGame = {
      "@type": "VideoGame", "@id": `${url}#game-${index + 1}`,
      name: game.heading || page.title, description: game.description || page.tagline || page.metaDescription || undefined,
      genre: game.genre, gamePlatform: "Web browser",
      playMode: game.players ? [...(game.players.min === 1 ? ["SinglePlayer"] : []), ...(game.players.max > 1 ? ["MultiPlayer"] : [])] : undefined,
      numberOfPlayers: game.players ? { "@type": "QuantitativeValue", minValue: game.players.min, maxValue: game.players.max } : undefined,
      audience: game.ageRating ? { "@type": "PeopleAudience", suggestedMinAge: game.ageRating === "all" ? 0 : parseInt(game.ageRating) } : undefined,
      inLanguage: page.locale, url, image: safeHttpUrl(game.cover?.url),
    };
    graph.push(videoGame);
  });
  // Inspect original values before display normalization can coerce numeric text.
  const contact = (Array.isArray(page.content?.sections) ? page.content.sections : []).find((s: any) => s?.type === "contact")?.data;
  if (contact && (page.template === "COMPANY_PROFILE" || page.preset === "company-service" || contact.hours !== undefined)) graph.push({
    "@type": "LocalBusiness", name: page.title, url,
    address: clean(contact.address) || undefined, telephone: clean(contact.phone) || undefined,
    image: safeHttpUrl(content.logo),
    sameAs: (Array.isArray(contact.socials) ? contact.socials : []).map((s: any) => safeHttpUrl(s?.url)).filter((url: string | undefined) => url?.startsWith("https:")),
    openingHoursSpecification: (Array.isArray(contact.hours) ? contact.hours : []).filter(isBusinessHours).map((h: BusinessHours) => ({
      "@type": "OpeningHoursSpecification", dayOfWeek: [...new Set(h.days)].map(day => `https://schema.org/${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][DAYS.indexOf(day)]}`), opens: h.open, closes: h.close,
    })),
  });
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


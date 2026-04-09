import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { PageRenderer } from "@/templates/shared/PageRenderer";
import { parsePageSegments, buildPagePath } from "@/lib/parse-page-segments";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ segments: string[] }>;
}

/**
 * Parse Accept-Language header and return ordered locale preferences.
 * e.g. "ja,en-US;q=0.9,en;q=0.8" → ["ja", "en-US", "en"]
 */
function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [locale, q] = part.trim().split(";q=");
      return { locale: locale.trim(), quality: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.quality - a.quality)
    .map((item) => item.locale);
}

/**
 * Match browser language preferences against available locales.
 * Tries exact match first (e.g. "zh-CN"), then base language (e.g. "zh" → "zh-CN").
 */
function matchLocale(preferred: string[], available: string[]): string | null {
  for (const pref of preferred) {
    // Exact match
    if (available.includes(pref)) return pref;
    // Base language match: "en-US" → try "en"
    const base = pref.split("-")[0];
    if (available.includes(base)) return base;
    // Reverse: browser sends "zh", we have "zh-CN"
    const regionMatch = available.find((a) => a.startsWith(base + "-"));
    if (regionMatch) return regionMatch;
  }
  return null;
}

function extractLogo(page: any): string | null {
  const content = page.content as any;
  return content?.logo
    || content?.sections?.find((s: any) => s.type === "hero")?.data?.logo
    || page.heroImage
    || null;
}

function buildJsonLd(page: any, url: string) {
  const content = page.content as any;
  const downloadSection = content?.sections?.find((s: any) => s.type === "download");
  const platforms: string[] = [];
  if (downloadSection?.data?.appStoreUrl) platforms.push("iOS");
  if (downloadSection?.data?.playStoreUrl) platforms.push("Android");

  return {
    "@context": "https://schema.org",
    "@type": downloadSection ? "SoftwareApplication" : "WebPage",
    name: page.title,
    description: page.metaDescription || page.tagline || undefined,
    url,
    image: page.ogImage || page.heroImage || undefined,
    inLanguage: page.locale,
    ...(downloadSection
      ? {
          applicationCategory: "Application",
          operatingSystem: platforms.join(", ") || undefined,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }
      : {}),
  };
}

/** Resolve a root page from DB: explicit locale or default */
async function resolvePage(slug: string, explicitLocale: string | null) {
  if (explicitLocale) {
    return db.hostedPage.findFirst({
      where: { slug, locale: explicitLocale, isPublished: true, parentSlug: null },
    });
  }
  // No locale in URL — find the default, fallback to first
  return db.hostedPage.findFirst({
    where: { slug, isPublished: true, parentSlug: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

/** Resolve a child page (parentSlug=root.slug) within the same organization. */
async function resolveChildPage(
  parentSlug: string,
  childSlug: string,
  explicitLocale: string | null,
  organizationId: string,
) {
  if (explicitLocale) {
    return db.hostedPage.findFirst({
      where: {
        organizationId,
        parentSlug,
        slug: childSlug,
        locale: explicitLocale,
        isPublished: true,
      },
    });
  }
  return db.hostedPage.findFirst({
    where: {
      organizationId,
      parentSlug,
      slug: childSlug,
      isPublished: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

/** Load all sibling child pages for header nav. */
async function loadSiblings(parentSlug: string, organizationId: string, locale: string) {
  // Prefer pages in the matching locale; fall back to default variant per slug.
  return db.hostedPage.findMany({
    where: {
      organizationId,
      parentSlug,
      isPublished: true,
      OR: [{ locale }, { isDefault: true }],
    },
    select: { slug: true, locale: true, title: true, isDefault: true },
    orderBy: [{ createdAt: "asc" }],
  });
}

interface NavItem {
  label: string;
  target: string;
}

/**
 * Build the navigation list for a site. Priority:
 *   1. Explicit `content.nav` array on the root page
 *   2. Auto-generated from sibling child pages (one entry per child)
 *   3. Empty list if neither exists
 */
function buildNav(
  rootContent: unknown,
  siblings: Array<{ slug: string; title: string }>,
  rootHref: string,
): NavItem[] {
  const explicit = (rootContent as { nav?: unknown })?.nav;
  if (Array.isArray(explicit)) {
    return explicit
      .filter((item): item is NavItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as NavItem).label === "string" &&
        typeof (item as NavItem).target === "string",
      )
      .map((item) => ({ label: item.label, target: item.target }));
  }
  if (siblings.length > 0) {
    return [
      { label: "Home", target: rootHref },
      ...siblings.map((s) => ({ label: s.title, target: s.slug })),
    ];
  }
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;
  const parsed = parsePageSegments(segments);
  if (!parsed || parsed.subpage) return {};

  const { slug, locale: explicitLocale, childSlug } = parsed;
  const rootPage = await resolvePage(slug, explicitLocale);
  if (!rootPage) return {};
  // For child pages, return metadata for the child while still using the
  // root's locale variants for hreflang alternates.
  const page = childSlug
    ? await resolveChildPage(slug, childSlug, explicitLocale, rootPage.organizationId)
    : rootPage;
  if (!page) return {};

  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";
  const logoUrl = extractLogo(page);

  // Build hreflang alternates
  const variants = await db.hostedPage.findMany({
    where: { slug, isPublished: true },
    select: { locale: true, isDefault: true },
  });

  const languages: Record<string, string> = {};
  for (const v of variants) {
    languages[v.locale] = `${baseUrl}${buildPagePath(slug, v.locale, null, v.isDefault)}`;
  }
  const defaultVariant = variants.find((v) => v.isDefault) || variants[0];
  if (defaultVariant) {
    languages["x-default"] = `${baseUrl}${buildPagePath(slug, defaultVariant.locale, null, true)}`;
  }

  const title = page.metaTitle || page.title;
  const description = page.metaDescription || page.tagline || undefined;
  const image = page.ogImage || page.heroImage || undefined;
  const canonicalUrl = `${baseUrl}${buildPagePath(slug, page.locale, null, page.isDefault)}`;

  return {
    title,
    description,
    icons: logoUrl ? { icon: logoUrl, apple: logoUrl } : undefined,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
      locale: page.locale,
      type: "website",
      url: canonicalUrl,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
  };
}

export default async function HostedPage({ params }: Props) {
  const { segments } = await params;
  const parsed = parsePageSegments(segments);
  if (!parsed) notFound();

  const { slug, locale: explicitLocale, subpage, childSlug } = parsed;

  // Auto-detect language: when no locale in URL, check browser preference.
  // Skip if: user explicitly chose a language (cookie), or visiting a subpage,
  // or visiting a child page (locale is inherited from how they got here).
  if (!explicitLocale && !subpage && !childSlug) {
    const headersList = await headers();
    const cookieHeader = headersList.get("cookie") || "";
    const hasLocalePreference = cookieHeader.includes("appai_locale=");

    if (!hasLocalePreference) {
      const acceptLang = headersList.get("accept-language");
      const preferred = parseAcceptLanguage(acceptLang);

      if (preferred.length > 0) {
        const variants = await db.hostedPage.findMany({
          where: { slug, isPublished: true },
          select: { locale: true, isDefault: true },
        });

        if (variants.length > 1) {
          const available = variants.map((v) => v.locale);
          const matched = matchLocale(preferred, available);
          const defaultLocale = variants.find((v) => v.isDefault)?.locale || variants[0]?.locale;

          // Only redirect if matched locale differs from default
          if (matched && matched !== defaultLocale) {
            redirect(buildPagePath(slug, matched, null, false));
          }
        }
      }
    }
  }

  const rootPage = await resolvePage(slug, explicitLocale);
  if (!rootPage) notFound();

  // Resolve the actual page being rendered: child page if childSlug present,
  // otherwise the root page itself.
  const page = childSlug
    ? await resolveChildPage(slug, childSlug, explicitLocale, rootPage.organizationId)
    : rootPage;
  if (!page) notFound();

  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";
  const pageUrl = `${baseUrl}${buildPagePath(slug, page.locale, null, page.isDefault)}`;

  // Load sibling child pages and build the site nav. Empty array if this site
  // is single-page; <PageRenderer> renders nothing in that case.
  const siblings = await loadSiblings(slug, rootPage.organizationId, page.locale);
  const rootHref = buildPagePath(slug, rootPage.locale, null, rootPage.isDefault);
  const nav = buildNav(rootPage.content, siblings, rootHref);

  // Privacy subpage
  if (subpage === "privacy") {
    if (!page.privacyPolicy) notFound();
    return (
      <div className="max-w-3xl mx-auto py-16 px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <a href={buildPagePath(slug, page.locale, null, page.isDefault)} className="hover:text-gray-900">{page.title}</a>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900">Privacy Policy</span>
        </nav>
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">{page.title}</p>
        <div className="prose prose-lg max-w-none whitespace-pre-wrap text-gray-700">
          {page.privacyPolicy}
        </div>
      </div>
    );
  }

  // Terms subpage
  if (subpage === "terms") {
    if (!page.termsOfService) notFound();
    return (
      <div className="max-w-3xl mx-auto py-16 px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <a href={buildPagePath(slug, page.locale, null, page.isDefault)} className="hover:text-gray-900">{page.title}</a>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900">Terms of Service</span>
        </nav>
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-8">{page.title}</p>
        <div className="prose prose-lg max-w-none whitespace-pre-wrap text-gray-700">
          {page.termsOfService}
        </div>
      </div>
    );
  }

  // Main landing page
  const jsonLd = buildJsonLd(page, pageUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {page.customCss && <style>{page.customCss}</style>}
      <PageRenderer page={page} nav={nav} />
    </>
  );
}

export const revalidate = 60;

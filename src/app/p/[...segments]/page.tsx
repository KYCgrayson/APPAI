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

/** Resolve page from DB: explicit locale or default */
async function resolvePage(slug: string, explicitLocale: string | null) {
  if (explicitLocale) {
    return db.hostedPage.findFirst({
      where: { slug, locale: explicitLocale, isPublished: true },
    });
  }
  // No locale in URL — find the default, fallback to first
  return db.hostedPage.findFirst({
    where: { slug, isPublished: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;
  const parsed = parsePageSegments(segments);
  if (!parsed || parsed.subpage) return {};

  const { slug, locale: explicitLocale } = parsed;
  const page = await resolvePage(slug, explicitLocale);
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

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.tagline || undefined,
    icons: logoUrl ? { icon: logoUrl, apple: logoUrl } : undefined,
    openGraph: {
      title: page.metaTitle || page.title,
      description: page.metaDescription || page.tagline || undefined,
      images: page.ogImage ? [page.ogImage] : undefined,
      locale: page.locale,
    },
    alternates: {
      languages,
    },
  };
}

export default async function HostedPage({ params }: Props) {
  const { segments } = await params;
  const parsed = parsePageSegments(segments);
  if (!parsed) notFound();

  const { slug, locale: explicitLocale, subpage } = parsed;

  // Auto-detect language: when no locale in URL, check browser preference
  // Skip if: user explicitly chose a language (cookie), or visiting a subpage
  if (!explicitLocale && !subpage) {
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

  const page = await resolvePage(slug, explicitLocale);
  if (!page) notFound();

  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";
  const pageUrl = `${baseUrl}${buildPagePath(slug, page.locale, null, page.isDefault)}`;

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
      <PageRenderer page={page} />
    </>
  );
}

export const revalidate = 60;

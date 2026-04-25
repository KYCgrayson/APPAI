import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { PageRenderer } from "@/templates/shared/PageRenderer";
import { parsePageSegments, buildPagePath } from "@/lib/parse-page-segments";
import { checkIframeToolUrl } from "@/lib/iframe-tool-allowlist";
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

function extractLogos(page: any): { headerLogo: string | null; heroLogo: string | null } {
  const content = page.content as any;
  const defaultLogo = content?.logo
    || content?.sections?.find((s: any) => s.type === "hero")?.data?.logo
    || page.heroImage
    || null;
  return {
    headerLogo: page.headerLogo || defaultLogo,
    heroLogo: defaultLogo,
  };
}

interface BreadcrumbEntry {
  name: string;
  url: string;
}

function buildBreadcrumbList(baseUrl: string, entries: BreadcrumbEntry[]) {
  if (entries.length === 0) return null;
  return {
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.url.startsWith("http") ? entry.url : `${baseUrl}${entry.url}`,
    })),
  };
}

function buildJsonLd(
  page: any,
  url: string,
  baseUrl: string,
  breadcrumb: ReturnType<typeof buildBreadcrumbList>,
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
    image: page.ogImage || page.heroImage || undefined,
    inLanguage: page.locale,
    datePublished: page.createdAt ? new Date(page.createdAt).toISOString() : undefined,
    dateModified: page.updatedAt ? new Date(page.updatedAt).toISOString() : undefined,
    isPartOf: { "@id": `${baseUrl}/#website` },
    publisher: { "@id": `${baseUrl}/#org` },
  };

  if (downloadSection) {
    primary.applicationCategory = "Application";
    if (platforms.length > 0) primary.operatingSystem = platforms.join(", ");
    primary.offers = { "@type": "Offer", price: "0", priceCurrency: "USD" };
  }

  const graph: any[] = [primary];
  if (breadcrumb) graph.push(breadcrumb);

  return {
    "@context": "https://schema.org",
    "@graph": graph,
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

// Nav loading + building lives in @/lib/site-nav. It's rendered inline in the
// sticky header in layout.tsx, so page.tsx no longer needs to build nav itself.

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;
  const parsed = parsePageSegments(segments);
  if (!parsed || parsed.subpage) return {};

  // Tool fullscreen: minimal metadata, noindex (the parent page is the canonical SEO target).
  if (parsed.toolOrder !== null) {
    const rootPage = await db.hostedPage.findFirst({
      where: { slug: parsed.slug, isPublished: true, parentSlug: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { title: true, content: true },
    });
    const sections = ((rootPage?.content as { sections?: Array<{ type: string; order: number; data: Record<string, unknown> }> })?.sections) || [];
    const section = sections.find((s) => s.order === parsed.toolOrder);
    const data = (section?.data ?? {}) as { heading?: string; description?: string };
    return {
      title: data.heading ? `${data.heading} — ${rootPage?.title ?? ""}` : rootPage?.title,
      description: data.description,
      robots: { index: false, follow: false },
    };
  }

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
  const { headerLogo: logoUrl } = extractLogos(page);

  // Build hreflang alternates against the correct variant set:
  //   - root page: all root variants with this slug
  //   - child page: all child variants with (parentSlug=slug, slug=childSlug)
  //     in the same organization
  const variants = childSlug
    ? await db.hostedPage.findMany({
        where: {
          organizationId: rootPage.organizationId,
          parentSlug: slug,
          slug: childSlug,
          isPublished: true,
        },
        select: { locale: true, isDefault: true },
      })
    : await db.hostedPage.findMany({
        where: { slug, isPublished: true, parentSlug: null },
        select: { locale: true, isDefault: true },
      });

  const languages: Record<string, string> = {};
  for (const v of variants) {
    languages[v.locale] = childSlug
      ? `${baseUrl}${buildPagePath(slug, v.locale, null, v.isDefault)}/${childSlug}`
      : `${baseUrl}${buildPagePath(slug, v.locale, null, v.isDefault)}`;
  }
  const defaultVariant = variants.find((v) => v.isDefault) || variants[0];
  if (defaultVariant) {
    languages["x-default"] = childSlug
      ? `${baseUrl}${buildPagePath(slug, defaultVariant.locale, null, true)}/${childSlug}`
      : `${baseUrl}${buildPagePath(slug, defaultVariant.locale, null, true)}`;
  }

  const title = page.metaTitle || page.title;
  const description = page.metaDescription || page.tagline || undefined;
  const image = page.ogImage || page.heroImage || undefined;
  const defaultCanonical = childSlug
    ? `${baseUrl}${buildPagePath(slug, page.locale, null, page.isDefault)}/${childSlug}`
    : `${baseUrl}${buildPagePath(slug, page.locale, null, page.isDefault)}`;
  const canonicalUrl = page.canonicalUrl || defaultCanonical;
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

  const { slug, locale: explicitLocale, subpage, childSlug, toolOrder } = parsed;

  // Iframe-tool fullscreen view: /p/{slug}/tools/{order}.
  // Renders just the iframe at viewport size, no site chrome (handled by layout).
  if (toolOrder !== null) {
    const rootPage = await db.hostedPage.findFirst({
      where: { slug, isPublished: true, parentSlug: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    if (!rootPage) notFound();
    const sections = ((rootPage.content as { sections?: Array<{ type: string; order: number; data: Record<string, unknown> }> })?.sections) || [];
    const section = sections.find((s) => s.order === toolOrder);
    if (!section || section.type !== "iframe-tool") notFound();
    const data = section.data as { src?: string; heading?: string; allowFullscreen?: boolean };
    const check = data.src ? checkIframeToolUrl(data.src) : { ok: false as const };
    if (!check.ok || !check.url) notFound();

    const themeColor = rootPage.themeColor || "#000000";
    const url = new URL(data.src!);
    url.searchParams.set("locale", rootPage.locale);
    url.searchParams.set("color", themeColor);
    if (rootPage.darkMode) url.searchParams.set("theme", "dark");

    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: rootPage.darkMode ? "#000" : "#fff" }}>
        <iframe
          src={url.toString()}
          title={data.heading || rootPage.title}
          loading="eager"
          allow={data.allowFullscreen === false ? undefined : "fullscreen; clipboard-write; gamepad; accelerometer; gyroscope"}
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        />
      </div>
    );
  }

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
  const rootUrl = `${baseUrl}${buildPagePath(slug, rootPage.locale, null, rootPage.isDefault)}`;
  const pageUrl = childSlug
    ? `${rootUrl}/${childSlug}`
    : subpage
      ? `${baseUrl}${buildPagePath(slug, page.locale, subpage, page.isDefault)}`
      : `${baseUrl}${buildPagePath(slug, page.locale, null, page.isDefault)}`;

  // Privacy subpage
  if (subpage === "privacy") {
    if (!page.privacyPolicy) notFound();
    const privacyBreadcrumb = buildBreadcrumbList(baseUrl, [
      { name: rootPage.title, url: rootUrl },
      { name: "Privacy Policy", url: pageUrl },
    ]);
    const privacyLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${pageUrl}#page`,
          name: `Privacy Policy — ${rootPage.title}`,
          url: pageUrl,
          inLanguage: page.locale,
          datePublished: page.createdAt ? new Date(page.createdAt).toISOString() : undefined,
          dateModified: page.updatedAt ? new Date(page.updatedAt).toISOString() : undefined,
          isPartOf: { "@id": `${baseUrl}/#website` },
          publisher: { "@id": `${baseUrl}/#org` },
        },
        privacyBreadcrumb,
      ].filter(Boolean),
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(privacyLd) }}
        />
        <div className="max-w-3xl mx-auto py-10 md:py-16 px-4 sm:px-6">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 md:mb-8 flex-wrap">
            <a href={buildPagePath(slug, page.locale, null, page.isDefault)} className="hover:text-gray-900 truncate max-w-[60%]">{page.title}</a>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900">Privacy Policy</span>
          </nav>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2 break-words">Privacy Policy</h1>
          <p className="text-gray-500 mb-6 md:mb-8 break-words">{page.title}</p>
          <div className="prose prose-base md:prose-lg max-w-none whitespace-pre-wrap break-words text-gray-700">
            {page.privacyPolicy}
          </div>
        </div>
      </>
    );
  }

  // Terms subpage
  if (subpage === "terms") {
    if (!page.termsOfService) notFound();
    const termsBreadcrumb = buildBreadcrumbList(baseUrl, [
      { name: rootPage.title, url: rootUrl },
      { name: "Terms of Service", url: pageUrl },
    ]);
    const termsLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${pageUrl}#page`,
          name: `Terms of Service — ${rootPage.title}`,
          url: pageUrl,
          inLanguage: page.locale,
          datePublished: page.createdAt ? new Date(page.createdAt).toISOString() : undefined,
          dateModified: page.updatedAt ? new Date(page.updatedAt).toISOString() : undefined,
          isPartOf: { "@id": `${baseUrl}/#website` },
          publisher: { "@id": `${baseUrl}/#org` },
        },
        termsBreadcrumb,
      ].filter(Boolean),
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(termsLd) }}
        />
        <div className="max-w-3xl mx-auto py-10 md:py-16 px-4 sm:px-6">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 md:mb-8 flex-wrap">
            <a href={buildPagePath(slug, page.locale, null, page.isDefault)} className="hover:text-gray-900 truncate max-w-[60%]">{page.title}</a>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900">Terms of Service</span>
          </nav>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2 break-words">Terms of Service</h1>
          <p className="text-gray-500 mb-6 md:mb-8 break-words">{page.title}</p>
          <div className="prose prose-base md:prose-lg max-w-none whitespace-pre-wrap break-words text-gray-700">
            {page.termsOfService}
          </div>
        </div>
      </>
    );
  }

  // Main landing page — build breadcrumb only when we're on a child page
  // (root pages are top-level, no breadcrumb needed).
  const breadcrumb = childSlug
    ? buildBreadcrumbList(baseUrl, [
        { name: rootPage.title, url: rootUrl },
        { name: page.title, url: pageUrl },
      ])
    : null;
  const jsonLd = buildJsonLd(page, pageUrl, baseUrl, breadcrumb);

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

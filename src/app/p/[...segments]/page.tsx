import { serializeJsonLd } from "@/lib/json-ld";
import { resolvePage, resolveChildPage } from "@/lib/hosted-page-resolver";
import { buildJsonLd, hostedOgImage } from "@/lib/hosted-page-seo";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { AppAIBadge } from "@/components/AppAIBadge";
import { PageRenderer } from "@/templates/shared/PageRenderer";
import { matchPreferredLocale, parseAcceptLanguage } from "@/lib/accept-language";
import { parsePageSegments, buildPagePath } from "@/lib/parse-page-segments";
import { buildIframeToolSrc, checkIframeToolUrl } from "@/lib/iframe-tool-allowlist";
import { issueIframeToolSession } from "@/lib/iframe-tool-session";
import { decideSectionAccess, sectionWantsIdentity } from "@/lib/iframe-tool-session-contract";
import { LoginGate } from "@/templates/shared/LoginGate";
import { IframeToolFrame } from "@/templates/sections/IframeToolFrame";
import { getPlatformLocale } from "@/lib/platform-locale";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ segments: string[] }>;
}

function extractLogos(page: { content: unknown; headerLogo: string | null; heroImage: string | null }): { headerLogo: string | null; heroLogo: string | null } {
  const content = page.content as { logo?: string; sections?: { type: string; data?: { logo?: string } }[] };
  const defaultLogo = content?.logo
    || content?.sections?.find((s) => s.type === "hero")?.data?.logo
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
  const image = hostedOgImage(page);
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

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isLoggedIn = !!userId;
  const isAdmin =
    ((session as unknown as { role?: string })?.role ?? "USER") === "ADMIN";

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
    const data = section.data as { src?: string; heading?: string; allowFullscreen?: boolean; access?: string };
    const check = data.src ? checkIframeToolUrl(data.src) : { ok: false as const };
    if (!check.ok || !check.url) notFound();

    const themeColor = rootPage.themeColor || "#000000";

    // The fullscreen view renders the same section, so it answers to the same
    // gate — and says the same thing about it. Without this it is a way around
    // `access`: gated inline while its own URL still hands the tool over.
    const decision = decideSectionAccess(data.access, { isLoggedIn, isAdmin });
    if (decision !== "render") {
      return (
        <LoginGate
          mode={decision}
          redirectTo={`/p/${rootPage.slug}/tools/${toolOrder}`}
          heading={data.heading || rootPage.title}
          description={rootPage.tagline || undefined}
          themeColor={themeColor}
          locale={rootPage.locale}
        />
      );
    }

    const grant = sectionWantsIdentity(data)
      ? issueIframeToolSession({ src: data.src!, slug: rootPage.slug, section: toolOrder, userId })
      : null;
    const src = buildIframeToolSrc(data.src!, {
      locale: rootPage.locale,
      themeColor,
      darkMode: rootPage.darkMode,
      sessionToken: grant?.token,
    });
    const identity = grant
      ? {
          token: grant.token,
          expiresAt: grant.expiresAt.toISOString(),
          pageId: rootPage.id,
          section: toolOrder,
        }
      : null;

    // The badge is AppAI's own chrome rather than publisher content, so it
    // follows the visitor's platform language — the page's own locale system
    // governs the publisher's copy inside the iframe, not our shell.
    const chromeLocale = await getPlatformLocale();
    const tc = await getTranslations({ locale: chromeLocale, namespace: "common" });

    return (
      <IframeToolFrame
        src={src}
        trustedOrigin={check.url.origin}
        title={data.heading || rootPage.title}
        allowFullscreen={data.allowFullscreen}
        darkMode={rootPage.darkMode}
        identity={identity}
      >
        {/* Without this the fullscreen view has no header and no footer: no way
            back to the directory, and no signal about whether you are signed in
            when the tool itself is login-gated. */}
        <AppAIBadge
          signedIn={isLoggedIn}
          dark={rootPage.darkMode}
          labels={{
            browse: tc("browseApps"),
            signIn: tc("signIn"),
            signedIn: tc("signedIn"),
          }}
        />
      </IframeToolFrame>
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
          const matched = matchPreferredLocale(preferred, available);
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
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(privacyLd) }}
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
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(termsLd) }}
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
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      {page.customCss && <style>{page.customCss}</style>}
      <PageRenderer page={page} isLoggedIn={isLoggedIn} isAdmin={isAdmin} userId={userId} />
    </>
  );
}

export const revalidate = 60;

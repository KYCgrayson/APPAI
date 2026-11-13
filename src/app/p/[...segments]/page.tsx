import { publicPageWhere } from "@/lib/hosted-page-visibility";
import { normalizeHostedContent, contentString } from "@/lib/hosted-content";
import { Breadcrumb } from "@/components/Breadcrumb";
import { breadcrumbJsonLd } from "@/lib/breadcrumbs";
import { hostedBreadcrumbs } from "@/lib/hosted-breadcrumbs";
import { hostedNavigationCopy } from "@/lib/hosted-navigation-copy";
import { serializeJsonLd } from "@/lib/json-ld";
import { resolvePage, resolveChildPage } from "@/lib/hosted-page-resolver";
import { hostedPageUrl, hostedAlternates, hasExternalCanonical } from "@/lib/hosted-page-urls";
import { hostedLegalCopy } from "@/lib/hosted-legal-copy";
import { PLATFORM_ORIGIN } from "@/lib/platform-identity";
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
  const content = normalizeHostedContent(page.content);
  const defaultLogo = contentString(content.logo)
    || contentString(content.sections.find((s) => s.type === "hero")?.data.logo)
    || page.heroImage
    || null;
  return {
    headerLogo: page.headerLogo || defaultLogo,
    heroLogo: defaultLogo,
  };
}

// Nav loading + building lives in @/lib/site-nav. It's rendered inline in the
// sticky header in layout.tsx, so page.tsx no longer needs to build nav itself.

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;
  const parsed = parsePageSegments(segments);
  if (!parsed) return {};

  // Tool fullscreen: minimal metadata, noindex (the parent page is the canonical SEO target).
  if (parsed.toolOrder !== null) {
    const rootPage = await db.hostedPage.findFirst({
      where: { slug: parsed.slug, ...publicPageWhere() },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { title: true, content: true },
    });
    const sections = normalizeHostedContent(rootPage?.content).sections;
    const section = sections.find((s) => s.order === parsed.toolOrder);
    const data = (section?.data ?? {}) as { heading?: string; description?: string };
    return {
      title: data.heading ? `${data.heading} — ${rootPage?.title ?? ""}` : rootPage?.title,
      description: data.description,
      robots: { index: false, follow: false },
    };
  }

  const { slug, locale: explicitLocale, childSlug, subpage } = parsed;
  const rootPage = await resolvePage(slug, explicitLocale);
  if (!rootPage) return {};
  const page = childSlug
    ? await resolveChildPage(slug, childSlug, explicitLocale, rootPage.organizationId)
    : rootPage;
  if (!page) return {};

  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";
  const { headerLogo: logoUrl } = extractLogos(page);

  const roots = await db.hostedPage.findMany({
    where: { slug, organizationId: rootPage.organizationId, ...publicPageWhere() },
    orderBy: { locale: "asc" },
  });
  const variants = childSlug ? await db.hostedPage.findMany({
    where: { organizationId: rootPage.organizationId, parentSlug: slug, slug: childSlug, ...publicPageWhere(roots) },
    orderBy: { locale: "asc" },
  }) : roots;
  const legal = subpage ? hostedLegalCopy(page.locale, subpage, page.title) : null;
  const title = legal?.title || page.metaTitle || page.title;
  const description = legal?.description || page.metaDescription || page.tagline || undefined;
  const image = hostedOgImage(page);
  // A locale-free child route can resolve a first published child even when
  // its locale has no parent variant. Preserve that reachable fallback URL.
  const defaultCanonical = hostedPageUrl(page, [rootPage, ...roots], baseUrl, subpage)
    || (childSlug ? `${baseUrl}${buildPagePath(slug, explicitLocale || rootPage.locale, childSlug, !explicitLocale)}` : null);
  // Policy documents have their own identity, independent of the marketing URL.
  const canonicalUrl = (!subpage && page.canonicalUrl) || defaultCanonical || undefined;
  const languages = !subpage && hasExternalCanonical(page, baseUrl)
    ? undefined : hostedAlternates(variants, roots, baseUrl, subpage);
  return {
    title,
    description,
    // Derived script variants are useful to readers but are not original translations.
    robots: page.autoConverted ? { index: false, follow: true } : undefined,
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
      where: { slug, ...publicPageWhere() },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    if (!rootPage) notFound();
    const sections = normalizeHostedContent(rootPage?.content).sections;
    const section = sections.find((s) => s.order === toolOrder);
    if (!section || section.type !== "iframe-tool") notFound();
    const data = section.data as { src?: string; heading?: string; allowFullscreen?: boolean; access?: string };
    const check = data.src ? checkIframeToolUrl(data.src) : { ok: false as const };
    if (!check.ok || !check.url) notFound();

    const themeColor = rootPage.themeColor || "#000000";
    const toolTrail = hostedBreadcrumbs(rootPage, [rootPage], rootPage.locale, {
      name: data.heading || rootPage.title, href: `/p/${rootPage.slug}/tools/${toolOrder}`,
    });
    const toolBreadcrumb = <>
      <Breadcrumb items={toolTrail} label={hostedNavigationCopy(rootPage.locale).breadcrumb}
        themeColor={themeColor} dark={rootPage.darkMode} className="shrink-0 px-4 py-2 sm:px-6" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
        "@context": "https://schema.org", ...breadcrumbJsonLd(toolTrail, PLATFORM_ORIGIN),
      }) }} />
    </>;

    // The fullscreen view renders the same section, so it answers to the same
    // gate — and says the same thing about it. Without this it is a way around
    // `access`: gated inline while its own URL still hands the tool over.
    const decision = decideSectionAccess(data.access, { isLoggedIn, isAdmin });
    if (decision !== "render") {
      return (
        <>
        {toolBreadcrumb}
        <LoginGate
          mode={decision}
          redirectTo={`/p/${rootPage.slug}/tools/${toolOrder}`}
          heading={data.heading || rootPage.title}
          description={rootPage.tagline || undefined}
          themeColor={themeColor}
          locale={rootPage.locale}
        />
        </>
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
        navigation={toolBreadcrumb}
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
          where: { slug, ...publicPageWhere() },
          select: { locale: true, isDefault: true },
          orderBy: { locale: "asc" },
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
  const roots = [rootPage, ...await db.hostedPage.findMany({
    where: { slug, organizationId: rootPage.organizationId, ...publicPageWhere() },
    orderBy: { locale: "asc" },
  })];
  const pageUrl = (!subpage && page.canonicalUrl) || hostedPageUrl(page, roots, baseUrl, subpage)
    || (childSlug ? `${baseUrl}${buildPagePath(slug, explicitLocale || rootPage.locale, childSlug, !explicitLocale)}` : null);
  if (!pageUrl) notFound();
  const legal = subpage ? hostedLegalCopy(page.locale, subpage, page.title) : null;

  const trail = childSlug || subpage ? hostedBreadcrumbs(rootPage, roots, page.locale, {
    name: legal?.heading ?? page.title,
    href: hostedPageUrl(page, roots, baseUrl, subpage) ?? pageUrl,
  }) : [];
  const breadcrumb = breadcrumbJsonLd(trail, baseUrl);
  const visibleBreadcrumb = trail.length > 0 ? <Breadcrumb items={trail}
    label={hostedNavigationCopy(page.locale).breadcrumb} themeColor={rootPage.themeColor}
    dark={!subpage && page.darkMode} className="px-4 py-2 sm:px-6" /> : null;

  // Privacy subpage
  if (subpage === "privacy") {
    if (!page.privacyPolicy) notFound();
    const privacyLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${pageUrl}#page`,
          name: legal!.title,
          url: pageUrl,
          inLanguage: page.locale,
          datePublished: page.createdAt ? new Date(page.createdAt).toISOString() : undefined,
          dateModified: page.updatedAt ? new Date(page.updatedAt).toISOString() : undefined,
          isPartOf: { "@id": `${PLATFORM_ORIGIN}/#website` },
          publisher: { "@id": `${PLATFORM_ORIGIN}/#org` },
        },
        breadcrumb,
      ].filter(Boolean),
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(privacyLd) }}
        />
        {visibleBreadcrumb}
        <div className="max-w-3xl mx-auto py-10 md:py-16 px-4 sm:px-6">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2 break-words">{legal!.heading}</h1>
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
    const termsLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${pageUrl}#page`,
          name: legal!.title,
          url: pageUrl,
          inLanguage: page.locale,
          datePublished: page.createdAt ? new Date(page.createdAt).toISOString() : undefined,
          dateModified: page.updatedAt ? new Date(page.updatedAt).toISOString() : undefined,
          isPartOf: { "@id": `${PLATFORM_ORIGIN}/#website` },
          publisher: { "@id": `${PLATFORM_ORIGIN}/#org` },
        },
        breadcrumb,
      ].filter(Boolean),
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(termsLd) }}
        />
        {visibleBreadcrumb}
        <div className="max-w-3xl mx-auto py-10 md:py-16 px-4 sm:px-6">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2 break-words">{legal!.heading}</h1>
          <p className="text-gray-500 mb-6 md:mb-8 break-words">{page.title}</p>
          <div className="prose prose-base md:prose-lg max-w-none whitespace-pre-wrap break-words text-gray-700">
            {page.termsOfService}
          </div>
        </div>
      </>
    );
  }

  const jsonLd = buildJsonLd(page, pageUrl, baseUrl, breadcrumb);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      {visibleBreadcrumb}
      {page.customCss && <style>{page.customCss}</style>}
      <PageRenderer page={{ ...page, videoPageUrl: hostedPageUrl(page, roots, baseUrl) || pageUrl }} isLoggedIn={isLoggedIn} isAdmin={isAdmin} userId={userId} />
    </>
  );
}

export const revalidate = 60;

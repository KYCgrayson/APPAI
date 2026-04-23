import { db } from "@/lib/db";
import { parsePageSegments, buildPagePath } from "@/lib/parse-page-segments";
import { LocaleLink } from "./LocaleLink";
import { PageViewTracker } from "@/components/PageViewTracker";
import { getExternalCanonical } from "@/lib/canonical";
import { loadSiblings, buildNav, resolveNavHref } from "@/lib/site-nav";

interface Props {
  params: Promise<{ segments: string[] }>;
  children: React.ReactNode;
}

export default async function HostedPageLayout({ params, children }: Props) {
  const { segments } = await params;
  const parsed = parsePageSegments(segments);
  if (!parsed) return <>{children}</>;

  const { slug, locale: explicitLocale } = parsed;

  // Resolve locale: explicit from URL, or find the default for this slug
  let page;
  if (explicitLocale) {
    page = await db.hostedPage.findFirst({
      where: { slug, locale: explicitLocale, isPublished: true },
      select: {
        id: true,
        organizationId: true,
        slug: true,
        locale: true,
        isDefault: true,
        title: true,
        content: true,
        themeColor: true,
        heroImage: true,
        headerLogo: true,
        privacyPolicy: true,
        termsOfService: true,
        isPublished: true,
        canonicalUrl: true,
      },
    });
  } else {
    // No locale in URL — find the default, fallback to first available
    page = await db.hostedPage.findFirst({
      where: { slug, isPublished: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        organizationId: true,
        slug: true,
        locale: true,
        isDefault: true,
        title: true,
        content: true,
        themeColor: true,
        heroImage: true,
        headerLogo: true,
        privacyPolicy: true,
        termsOfService: true,
        isPublished: true,
        canonicalUrl: true,
      },
    });
  }

  if (!page) {
    return <>{children}</>;
  }

  const locale = page.locale;

  // Find all locale variants for the language switcher
  const variants = await db.hostedPage.findMany({
    where: { slug, isPublished: true },
    select: { locale: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { locale: "asc" }],
  });

  const themeColor = page.themeColor || "#000000";
  const content = page.content as any;

  const defaultLogo = content?.logo
    || content?.sections?.find((s: any) => s.type === "hero")?.data?.logo
    || page.heroImage;
  const logo = (page as any).headerLogo || defaultLogo;

  // Extract download URLs
  const downloadSection = content?.sections?.find((s: any) => s.type === "download");
  const appStoreUrl = downloadSection?.data?.appStoreUrl || content?.appStoreUrl;
  const playStoreUrl = downloadSection?.data?.playStoreUrl || content?.playStoreUrl;
  const hasDownload = appStoreUrl || playStoreUrl;

  const localeLabels: Record<string, string> = {
    en: "EN", ja: "日本語", "zh-CN": "简中", "zh-TW": "繁中", ko: "한국어",
    es: "ES", fr: "FR", de: "DE", pt: "PT", "pt-BR": "PT-BR",
    it: "IT", nl: "NL", ru: "RU", ar: "عربي", hi: "हिंदी",
    th: "ไทย", vi: "VI", id: "ID", ms: "MS", tr: "TR",
  };

  const isDemo = slug.startsWith("demo-");
  const externalCanonical = getExternalCanonical((page as any).canonicalUrl);

  // Build site nav once, for rendering inline in the sticky header. Nav is
  // derived from sibling child pages (deduped by locale + filtered by
  // hideFromNav + sorted by navOrder) or from an explicit content.nav[] on
  // the root page.
  const siblings = await loadSiblings(slug, page.organizationId, locale);
  const rootHref = buildPagePath(slug, page.locale, null, page.isDefault);
  const navItems = buildNav(content, siblings, rootHref, locale);
  const localeSegment = page.isDefault ? "" : page.locale;

  return (
    <div lang={locale} dir={locale === "ar" || locale === "he" ? "rtl" : "ltr"} className="min-h-screen bg-white flex flex-col">
      <PageViewTracker
        pageId={page.id}
        slug={page.slug}
        locale={page.locale}
        orgId={page.organizationId}
      />
      {/* Demo Ribbon */}
      {isDemo && (
        <div className="fixed top-0 left-0 z-[100] overflow-hidden pointer-events-none" style={{ width: 150, height: 150 }}>
          <div
            className="absolute text-white text-xs font-bold uppercase tracking-wider text-center"
            style={{
              width: 200,
              top: 28,
              left: -50,
              transform: "rotate(-45deg)",
              backgroundColor: "#EF4444",
              padding: "6px 0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            Demo
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
          <a href={buildPagePath(slug, locale, null, page.isDefault)} className="flex items-center gap-3 flex-shrink-0">
            {logo && (
              <img src={logo} alt={page.title} className="w-8 h-8 rounded-xl object-cover" />
            )}
            <span className="font-semibold text-lg">{page.title}</span>
          </a>
          {/* Site nav (multi-page sites only) — inline with header, hidden on mobile */}
          {navItems.length > 0 && (
            <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0">
              {navItems.map((item, i) => {
                const { href, external } = resolveNavHref(item.target, slug, localeSegment);
                return (
                  <a
                    key={i}
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors truncate"
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          )}
          <div className="flex items-center gap-4 ml-auto flex-shrink-0">
            {/* Language Switcher */}
            {variants.length > 1 && (
              <div className="flex items-center gap-1 text-sm">
                {variants.map((v) => (
                  <LocaleLink
                    key={v.locale}
                    href={buildPagePath(slug, v.locale, null, v.isDefault)}
                    locale={v.locale}
                    isActive={v.locale === locale}
                    label={localeLabels[v.locale] || v.locale.toUpperCase()}
                  />
                ))}
              </div>
            )}
            {externalCanonical && (
              <a
                href={externalCanonical.url}
                target="_blank"
                rel="noopener"
                className="text-sm text-gray-500 hover:text-gray-900 hidden sm:inline"
                title={`Visit the official site at ${externalCanonical.host}`}
              >
                Official site: {externalCanonical.host}
              </a>
            )}
            {page.privacyPolicy && (
              <a href={buildPagePath(slug, locale, "privacy", page.isDefault)} className="text-sm text-gray-500 hover:text-gray-900 hidden sm:inline">
                Privacy
              </a>
            )}
            {page.termsOfService && (
              <a href={buildPagePath(slug, locale, "terms", page.isDefault)} className="text-sm text-gray-500 hover:text-gray-900 hidden sm:inline">
                Terms
              </a>
            )}
            {hasDownload && (
              <a
                href={appStoreUrl || playStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white px-4 py-1.5 rounded-full font-medium"
                style={{ backgroundColor: themeColor }}
              >
                Download
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-8 border-t">
        {(page.privacyPolicy || page.termsOfService) && (
          <div className="flex justify-center gap-6 mb-4 text-sm text-gray-500">
            {page.privacyPolicy && (
              <a href={buildPagePath(slug, locale, "privacy", page.isDefault)} className="hover:text-gray-800">
                Privacy Policy
              </a>
            )}
            {page.termsOfService && (
              <a href={buildPagePath(slug, locale, "terms", page.isDefault)} className="hover:text-gray-800">
                Terms of Service
              </a>
            )}
          </div>
        )}
        <div className="text-center text-sm text-gray-400">
          {externalCanonical ? (
            <span className="inline-flex flex-wrap justify-center items-center gap-x-2">
              <span>Landing page</span>
              <span aria-hidden>·</span>
              <a href="https://appai.info" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
                Hosted on AppAI
              </a>
              <span aria-hidden>·</span>
              <a href={externalCanonical.url} target="_blank" rel="noopener" className="hover:text-gray-600">
                {externalCanonical.host}
              </a>
            </span>
          ) : (
            <a href="https://appai.info" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
              Hosted on AppAI
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}

import { publicPageWhere } from "@/lib/hosted-page-visibility";
import { hostedPagePath, isUnavailableHostedPolicyLink } from "@/lib/hosted-page-urls";
import { hostedNavigationCopy, hostedLinkFocus } from "@/lib/hosted-navigation-copy";
import { PLATFORM_ORIGIN } from "@/lib/platform-identity";
import { normalizeHostedContent, contentString } from "@/lib/hosted-content";
import { resolvePage, resolveChildPage } from "@/lib/hosted-page-resolver";
import { withChineseLocales, chineseScript } from "@/lib/zh-convert";
import Link from "next/link";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { AccountControls } from "@/components/AccountControls";
import { parsePageSegments } from "@/lib/parse-page-segments";
import { LocaleLink } from "./LocaleLink";
import { PageViewTracker } from "@/components/PageViewTracker";
import { getExternalCanonical } from "@/lib/canonical";
import { loadSiblings, buildNav, resolveNavHref, hostedChromeLabels } from "@/lib/site-nav";
import { MobileMenu } from "./MobileMenu";
import { AdaptiveChrome } from "./AdaptiveChrome";

interface Props {
  params: Promise<{ segments: string[] }>;
  children: React.ReactNode;
}

export default async function HostedPageLayout({ params, children }: Props) {
  const { segments } = await params;
  const parsed = parsePageSegments(segments);
  if (!parsed) return <>{children}</>;

  // Iframe-tool fullscreen views skip site chrome entirely — the iframe
  // takes the whole viewport.
  if (parsed.toolOrder !== null) return <>{children}</>;

  const { slug, locale: explicitLocale } = parsed;

  const page = await resolvePage(slug, explicitLocale);

  if (!page) {
    return <>{children}</>;
  }

  const childPage = parsed.childSlug
    ? await resolveChildPage(slug, parsed.childSlug, explicitLocale, page.organizationId) : null;
  const autoConverted = (childPage ?? page).autoConverted;
  const locale = childPage?.locale ?? page.locale;
  const labels = hostedChromeLabels(locale);
  const navigation = hostedNavigationCopy(locale);
  const rootVariants = await db.hostedPage.findMany({
    where: { slug, organizationId: page.organizationId, ...publicPageWhere() },
    orderBy: [{ isDefault: "desc" }, { locale: "asc" }],
  });
  const childVariants = parsed.childSlug ? await db.hostedPage.findMany({
    where: { organizationId: page.organizationId, parentSlug: slug, slug: parsed.childSlug, ...publicPageWhere(rootVariants) },
    orderBy: { locale: "asc" },
  }) : [];
  const variants = parsed.childSlug
    ? childVariants.filter(variant => hostedPagePath(variant, rootVariants))
    : parsed.subpage
      ? rootVariants.filter(variant => hostedPagePath(variant, rootVariants, parsed.subpage))
      : withChineseLocales(rootVariants).map(variant => ({ ...page, ...variant }));
  const variantHref = (variant: typeof variants[number]) =>
    hostedPagePath(variant, rootVariants, parsed.subpage)!;

  const themeColor = page.themeColor || "#000000";
  const content = normalizeHostedContent(page.content);
  const defaultLogo = contentString(content.logo)
    || contentString(content.sections.find(s => s.type === "hero")?.data.logo)
    || page.heroImage;
  const logo = page.headerLogo || defaultLogo;
  const downloadSection = content.sections.find(s => s.type === "download");
  const appStoreUrl = contentString(downloadSection?.data.appStoreUrl) || contentString(content.appStoreUrl);
  const playStoreUrl = contentString(downloadSection?.data.playStoreUrl) || contentString(content.playStoreUrl);
  const hasDownload = appStoreUrl || playStoreUrl;

  const localeLabels: Record<string, string> = {
    en: "EN", ja: "日本語", "zh-CN": "简中", "zh-TW": "繁中", ko: "한국어",
    es: "ES", fr: "FR", de: "DE", pt: "PT", "pt-BR": "PT-BR",
    it: "IT", nl: "NL", ru: "RU", ar: "عربي", hi: "हिंदी",
    th: "ไทย", vi: "VI", id: "ID", ms: "MS", tr: "TR",
  };

  const isDemo = slug.startsWith("demo-");
  const externalCanonical = getExternalCanonical(page.canonicalUrl);

  // Account state in the header. Hosted pages carry the interactive tools, and
  // several of them are login-gated, so "am I signed in?" has to be answerable
  // without leaving the page for the platform chrome at /[locale].
  // Returning here after sign-in means the exact URL, child pages included.
  const session = await auth();
  const currentPath = `/p/${segments.join("/")}`;

  // Build site nav once, for rendering inline in the sticky header. Nav is
  // derived from sibling child pages (deduped by locale + filtered by
  // hideFromNav + sorted by navOrder) or from an explicit content.nav[] on
  // the root page.
  const siblings = await loadSiblings(slug, page.organizationId, locale);
  // A default child can have a different locale from the default root.
  const localizedRoot = rootVariants.find(variant => variant.locale === locale) ?? page;
  const rootHref = hostedPagePath(localizedRoot, rootVariants)!;
  const isRootPage = !parsed.childSlug && !parsed.subpage;
  const currentPageHref = parsed.childSlug ? (childPage ? hostedPagePath(childPage, rootVariants) : null)
    : parsed.subpage ? hostedPagePath(page, rootVariants, parsed.subpage) : rootHref;
  const isCurrentHref = (href: string) => {
    if (!currentPageHref) return false;
    try {
      const url = new URL(href, PLATFORM_ORIGIN);
      return url.origin === PLATFORM_ORIGIN && !url.hash
        && [currentPath, currentPageHref].includes(url.pathname.replace(/\/$/, ""));
    } catch { return false; }
  };
  const localeSegment = page.isDefault ? "" : page.locale;
  const privacyHref = hostedPagePath(page, rootVariants, "privacy");
  const termsHref = hostedPagePath(page, rootVariants, "terms");
  const isHomeHref = (href: string) => {
    try {
      const url = new URL(href, PLATFORM_ORIGIN);
      const pathname = url.pathname.replace(/\/$/, "");
      return url.origin === PLATFORM_ORIGIN && (pathname === rootHref
        || (localizedRoot.isDefault && pathname === `${rootHref}/${localizedRoot.locale}`));
    } catch { return false; }
  };
  // The beside-name Home is shared by desktop and mobile. Remove that same
  // destination from both navs while retaining every sibling/custom entry.
  const filteredNavItems = buildNav(content, siblings, rootHref, locale, isRootPage)
    .filter(item => {
      const { href } = resolveNavHref(item.target, slug, localeSegment);
      return (isRootPage || !isHomeHref(href))
        && !isUnavailableHostedPolicyLink(href, [page, ...rootVariants]);
    });
  // Apply this after filtering: an empty policy can leave an explicit Home-only nav.
  const navItems = isRootPage && filteredNavItems.every(item =>
    isHomeHref(resolveNavHref(item.target, slug, localeSegment).href)) ? [] : filteredNavItems;

  // Pre-resolve hrefs for the mobile drawer. Keeping URL resolution on the
  // server keeps the client component pure-JSX.
  const mobileNavLinks = navItems.map((item) => {
    const { href, external } = resolveNavHref(item.target, slug, localeSegment);
    return { label: item.label, href, external, isCurrent: isCurrentHref(href) };
  });
  const mobileUtilityLinks: { label: string; href: string; external?: boolean; isCurrent?: boolean }[] = [
    { label: navigation.appai, href: "/" },
  ];
  if (externalCanonical) {
    mobileUtilityLinks.push({
      label: `${labels.officialSite}: ${externalCanonical.host}`,
      href: externalCanonical.url,
      external: true,
    });
  }
  if (privacyHref) {
    mobileUtilityLinks.push({
      label: labels.privacy,
      href: privacyHref,
      isCurrent: isCurrentHref(privacyHref),
    });
  }
  if (termsHref) {
    mobileUtilityLinks.push({
      label: labels.terms,
      href: termsHref,
      isCurrent: isCurrentHref(termsHref),
    });
  }
  // The drawer is the only chrome left on narrow screens, so the account
  // actions have to be reachable from it too.
  if (session?.user) {
    mobileUtilityLinks.push({ label: labels.dashboard, href: "/dashboard" });
    mobileUtilityLinks.push({
      label: labels.signOut,
      href: `/logout?callbackUrl=${encodeURIComponent(currentPath)}`,
    });
  } else {
    mobileUtilityLinks.push({
      label: labels.signIn,
      href: `/login?callbackUrl=${encodeURIComponent(currentPath)}`,
    });
  }

  const branding = (
    <a
      href={rootHref}
      aria-current={isRootPage ? "page" : undefined}
      className={isRootPage
        ? "flex items-center gap-3 min-w-0 shrink md:shrink-0 group-data-[cramped=true]/chrome:!shrink"
        : "flex items-center gap-1 md:gap-3 min-w-0 shrink md:shrink-0 group-data-[cramped=true]/chrome:!shrink"}
    >
      {logo && (<>
        {/* eslint-disable-next-line @next/next/no-img-element -- Publisher logo uses arbitrary hosts. */}
        <img src={logo} alt={page.title} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
      </>)}
      <span className="font-semibold text-lg truncate">{page.title}</span>
    </a>
  );
  const accountControls = (
    <AccountControls
      user={session?.user}
      isAdmin={
        ((session as unknown as { role?: string })?.role ?? "USER") ===
        "ADMIN"
      }
      callbackUrl={currentPath}
      labels={{
        signIn: labels.signIn,
        dashboard: labels.dashboard,
        signOut: labels.signOut,
        account: labels.account,
      }}
    />
  );

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

      {/* Sticky Header — AdaptiveChrome measures overflow and toggles
          data-cramped on its wrapper. Descendants that should hide when the
          header runs out of space use group-data-[cramped=true]/chrome:!hidden.
          The hamburger shows when cramped OR below the md breakpoint. */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <AdaptiveChrome compact={!isRootPage}>
          {isRootPage ? branding : (
            <div className="flex min-w-0 shrink items-center gap-0 md:gap-2 md:shrink-0 group-data-[cramped=true]/chrome:!shrink">
              {branding}
              <a href={rootHref} className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${hostedLinkFocus}`}>
                {navigation.home}
              </a>
            </div>
          )}

          {/* Desktop inline nav — natural widths so overflow is measurable */}
          {navItems.length > 0 && (
            <nav className="hidden md:flex items-center gap-1 flex-shrink-0 group-data-[cramped=true]/chrome:!hidden">
              {navItems.map((item, i) => {
                const { href, external } = resolveNavHref(item.target, slug, localeSegment);
                return (
                  <a
                    key={i}
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    aria-current={isCurrentHref(href) ? "page" : undefined}
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors whitespace-nowrap"
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          )}

          <div className={isRootPage
            ? "flex items-center gap-4 ml-auto flex-shrink-0"
            : "flex items-center gap-1 md:gap-4 ml-auto flex-shrink-0"}>
            <Link href="/" className={`hidden md:inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-gray-600 hover:text-gray-900 group-data-[cramped=true]/chrome:!hidden ${hostedLinkFocus}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Platform logo. */}
              <img src="/appai-logo2.png" alt="" className="h-4 w-4 rounded" />
              {navigation.appai}
            </Link>
            {variants.length > 1 && (
              <div className="hidden md:flex items-center gap-1 text-sm group-data-[cramped=true]/chrome:!hidden">
                {variants.map((v) => (
                  <LocaleLink
                    key={v.locale}
                    href={variantHref(v)}
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
                className="text-sm text-gray-500 hover:text-gray-900 hidden md:inline whitespace-nowrap group-data-[cramped=true]/chrome:!hidden"
                title={`${labels.officialSite}: ${externalCanonical.host}`}
              >
                {labels.officialSite}: {externalCanonical.host}
              </a>
            )}
            {privacyHref && (
              <a href={privacyHref} aria-current={isCurrentHref(privacyHref) ? "page" : undefined} className="text-sm text-gray-500 hover:text-gray-900 hidden md:inline whitespace-nowrap group-data-[cramped=true]/chrome:!hidden">
                {labels.privacy}
              </a>
            )}
            {termsHref && (
              <a href={termsHref} aria-current={isCurrentHref(termsHref) ? "page" : undefined} className="text-sm text-gray-500 hover:text-gray-900 hidden md:inline whitespace-nowrap group-data-[cramped=true]/chrome:!hidden">
                {labels.terms}
              </a>
            )}
            {hasDownload && (
              <a
                href={appStoreUrl || playStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline text-sm text-white px-4 py-1.5 rounded-full font-medium whitespace-nowrap group-data-[cramped=true]/chrome:!hidden"
                style={{ backgroundColor: themeColor }}
              >
                {labels.download}
              </a>
            )}

            {/* Account state. Unlike the links above it has no
                group-data-[cramped]/chrome:!hidden — being able to see at a
                glance that you are signed in is the point, so it survives
                every breakpoint. AccountControls truncates the name and drops
                its Dashboard link below sm to stay narrow. On non-root pages
                below 400px an account/sign-in icon leaves room for Home and
                longer localized sign-in labels. */}
            {!isRootPage && (
              <Link href={session?.user ? "/dashboard" : `/login?callbackUrl=${encodeURIComponent(currentPath)}`}
                title={session?.user ? session.user.name || session.user.email || labels.account : labels.signIn}
                aria-label={session?.user ? `${labels.account}: ${session.user.name || session.user.email || labels.account}` : labels.signIn}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-700 min-[400px]:hidden ${hostedLinkFocus}`}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                </svg>
              </Link>
            )}
            {!isRootPage ? <div className="hidden min-[400px]:flex items-center">
              {accountControls}
            </div> : accountControls}

            {/* Hamburger wrapper: shown when either (a) below md breakpoint OR
                (b) AdaptiveChrome reports cramped=true at any breakpoint. */}
            <div className="md:hidden group-data-[cramped=true]/chrome:md:!block">
              <MobileMenu
                navItems={mobileNavLinks}
                locales={variants.map((v) => ({
                  locale: v.locale,
                  href: variantHref(v),
                  label: localeLabels[v.locale] || v.locale.toUpperCase(),
                  isActive: v.locale === locale,
                }))}
                utilityLinks={mobileUtilityLinks}
                download={hasDownload ? { label: labels.download, href: (appStoreUrl || playStoreUrl) as string } : undefined}
                themeColor={themeColor}
                labels={isRootPage ? undefined : navigation}
                compact={!isRootPage}
              />
            </div>
          </div>
        </AdaptiveChrome>
      </header>

      {/* Page Content */}
      <main className="flex-1">
        {autoConverted && <p className="border-b bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          {chineseScript(locale) === "zh-TW" ? "此頁由簡體中文自動轉換" : "此页由繁体中文自动转换"}
        </p>}
        {children}
      </main>

      {/* Footer */}
      <footer className="py-8 border-t">
        {(privacyHref || termsHref) && (
          <div className="flex justify-center gap-6 mb-4 text-sm text-gray-500">
            {privacyHref && (
              <a href={privacyHref} className="hover:text-gray-800">
                {labels.privacyPolicy}
              </a>
            )}
            {termsHref && (
              <a href={termsHref} className="hover:text-gray-800">
                {labels.termsOfService}
              </a>
            )}
          </div>
        )}
        {/* Platform navigation stays subordinate to the publisher's branding. */}
        <div className="text-center text-sm text-gray-400">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/appai-logo2.png" alt="" aria-hidden className="h-4 w-4 rounded" />
            <span className="font-medium">{navigation.appai}</span>
          </Link>
          {externalCanonical && (
            <div className="mt-3 inline-flex w-full flex-wrap justify-center items-center gap-x-2 text-gray-400">
              <span>{labels.landingPage}</span>
              <span aria-hidden>·</span>
              <a href={externalCanonical.url} target="_blank" rel="noopener" className="hover:text-gray-600">
                {externalCanonical.host}
              </a>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

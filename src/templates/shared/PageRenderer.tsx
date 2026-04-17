import { HeroSection } from "../app-landing/sections/HeroSection";
import { FeaturesSection } from "../app-landing/sections/FeaturesSection";
import { ScreenshotsSection } from "../app-landing/sections/ScreenshotsSection";
import { DownloadSection } from "../app-landing/sections/DownloadSection";
import { FaqSection } from "../app-landing/sections/FaqSection";
import { VideoSection } from "../sections/VideoSection";
import { PricingSection } from "../sections/PricingSection";
import { TestimonialsSection } from "../sections/TestimonialsSection";
import { GallerySection } from "../sections/GallerySection";
import { TeamSection } from "../sections/TeamSection";
import { ScheduleSection } from "../sections/ScheduleSection";
import { SponsorsSection } from "../sections/SponsorsSection";
import { StatsSection } from "../sections/StatsSection";
import { ContactSection } from "../sections/ContactSection";
import { CtaSection } from "../sections/CtaSection";
import { LinksSection } from "../sections/LinksSection";
import { AboutSection } from "../sections/AboutSection";
import { ActionSection } from "../sections/ActionSection";
import { FormSection } from "../sections/FormSection";
import { MediaDownloaderSection } from "../sections/MediaDownloaderSection";
import { ToolSection } from "../sections/ToolSection";
import { PdfViewerSection } from "../sections/PdfViewerSection";
import { SiteNav } from "./SiteNav";

interface PageData {
  slug: string;
  template: string;
  title: string;
  tagline?: string | null;
  heroImage?: string | null;
  headerLogo?: string | null;
  content: any;
  themeColor?: string | null;
  themeColorSecondary?: string | null;
  fontFamily?: string | null;
  darkMode?: boolean;
  customCss?: string | null;
  privacyPolicy?: string | null;
  termsOfService?: string | null;
  parentSlug?: string | null;
  locale?: string;
}

function autoSecondaryColor(primary: string): string {
  const r = parseInt(primary.slice(1, 3), 16);
  const g = parseInt(primary.slice(3, 5), 16);
  const b = parseInt(primary.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c + (255 - c) * 0.75);
  return `#${blend(r).toString(16).padStart(2, "0")}${blend(g).toString(16).padStart(2, "0")}${blend(b).toString(16).padStart(2, "0")}`;
}

function renderSection(
  section: any,
  index: number,
  themeColor: string,
  themeColorSecondary: string,
  darkMode: boolean,
  page: PageData,
) {
  const props = { data: section.data, themeColor, themeColorSecondary, darkMode };
  const darkBg = darkMode ? "#111827" : undefined;
  const darkBgAlt = darkMode ? "#1f2937" : "#f9fafb";
  const bg = section.data?.backgroundColor || (index % 2 === 1 ? darkBgAlt : darkBg);

  let content;
  switch (section.type) {
    case "hero":
      content = <HeroSection {...props} />;
      break;
    case "video":
      content = <VideoSection {...props} />;
      break;
    case "features":
      content = <FeaturesSection {...props} />;
      break;
    case "screenshots":
      content = <ScreenshotsSection {...props} />;
      break;
    case "download":
      content = <DownloadSection {...props} />;
      break;
    case "pricing":
      content = <PricingSection {...props} />;
      break;
    case "testimonials":
      content = <TestimonialsSection {...props} />;
      break;
    case "faq":
      content = <FaqSection {...props} />;
      break;
    case "gallery":
      content = <GallerySection {...props} />;
      break;
    case "team":
      content = <TeamSection {...props} />;
      break;
    case "schedule":
      content = <ScheduleSection {...props} />;
      break;
    case "sponsors":
      content = <SponsorsSection {...props} />;
      break;
    case "stats":
      content = <StatsSection {...props} />;
      break;
    case "contact":
      content = <ContactSection {...props} />;
      break;
    case "cta":
      // CTA already has its own background color
      return <div key={index} id={section.data?.id || section.id || undefined}><CtaSection {...props} /></div>;
    case "links":
      content = <LinksSection {...props} />;
      break;
    case "about":
      content = <AboutSection {...props} />;
      break;
    case "action":
      content = <ActionSection {...props} />;
      break;
    case "media-downloader":
      content = <MediaDownloaderSection data={{ ...section.data, _pageSlug: page.slug }} themeColor={themeColor} themeColorSecondary={themeColorSecondary} darkMode={darkMode} />;
      break;
    case "tool":
      content = <ToolSection {...props} />;
      break;
    case "pdf-viewer":
      content = <PdfViewerSection {...props} />;
      break;
    case "form":
      content = (
        <FormSection
          data={section.data}
          themeColor={themeColor}
          pageSlug={page.slug}
          parentSlug={page.parentSlug ?? null}
          locale={page.locale ?? "en"}
          sectionOrder={section.order}
        />
      );
      break;
    default:
      return null;
  }

  // Optional anchor id for in-page navigation (#pricing, #faq, etc.)
  const sectionId = section.data?.id || section.id || undefined;

  // Hero section handles its own background
  if (section.type === "hero") {
    return <div key={index} id={sectionId}>{content}</div>;
  }

  return (
    <div key={index} id={sectionId} style={bg ? { backgroundColor: bg } : undefined}>
      {content}
    </div>
  );
}

function PageFooter({ slug, hasPrivacy, hasTerms, darkMode = false }: { slug: string; hasPrivacy: boolean; hasTerms: boolean; darkMode?: boolean }) {
  return (
    <footer className={`py-8 border-t ${darkMode ? "border-gray-700" : ""}`}>
      {(hasPrivacy || hasTerms) && (
        <div className={`flex justify-center gap-6 mb-4 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
          {hasPrivacy && (
            <a href={`/p/${slug}/privacy`} className={darkMode ? "hover:text-gray-200" : "hover:text-gray-800"}>
              Privacy Policy
            </a>
          )}
          {hasTerms && (
            <a href={`/p/${slug}/terms`} className={darkMode ? "hover:text-gray-200" : "hover:text-gray-800"}>
              Terms of Service
            </a>
          )}
        </div>
      )}
      <div className={`text-center text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
        <a href="https://appai.info" target="_blank" rel="noopener noreferrer" className={darkMode ? "hover:text-gray-300" : "hover:text-gray-600"}>
          Hosted on AppAI
        </a>
      </div>
    </footer>
  );
}

function PageHeader({ page, themeColor }: { page: PageData; themeColor: string }) {
  // Extract logo from content
  const logo = page.content?.logo
    || page.content?.sections?.find((s: any) => s.type === "hero")?.data?.logo
    || page.heroImage;

  // Extract download URLs
  const downloadSection = page.content?.sections?.find((s: any) => s.type === "download");
  const appStoreUrl = downloadSection?.data?.appStoreUrl || page.content?.appStoreUrl;
  const playStoreUrl = downloadSection?.data?.playStoreUrl || page.content?.playStoreUrl;
  const hasDownload = appStoreUrl || playStoreUrl;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <a href={`/p/${page.slug}`} className="flex items-center gap-3 min-w-0">
          {logo && (
            <img src={logo} alt={page.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          )}
          <span className="font-semibold text-base sm:text-lg truncate">{page.title}</span>
        </a>
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          {page.privacyPolicy && (
            <a href={`/p/${page.slug}/privacy`} className="text-sm text-gray-500 hover:text-gray-900 hidden sm:inline">
              Privacy
            </a>
          )}
          {page.termsOfService && (
            <a href={`/p/${page.slug}/terms`} className="text-sm text-gray-500 hover:text-gray-900 hidden sm:inline">
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
  );
}

export interface NavItem {
  label: string;
  /** Child page slug, anchor (#section), or absolute URL */
  target: string;
}

export interface SiteContext {
  /** Slug of the root page (used to build child page URLs in nav). */
  rootSlug: string;
  /** Locale segment to inject into nav links. Empty string when default locale. */
  localeSegment: string;
  /** Brand label shown in the nav (typically root page title). */
  brand: string;
  /** Optional logo URL shown next to the brand. */
  logo?: string | null;
}

export function PageRenderer({
  page,
  nav = [],
  site,
}: {
  page: PageData;
  /** Site navigation items. When non-empty, <SiteNav> renders at the top. */
  nav?: NavItem[];
  /** Site-level metadata for the nav. Required when nav is non-empty. */
  site?: SiteContext;
}) {
  const themeColor = page.themeColor || "#000000";
  const themeColorSecondary = page.themeColorSecondary || autoSecondaryColor(themeColor);
  const darkMode = page.darkMode ?? false;
  const fontFamily = page.fontFamily || undefined;
  const sections = page.content?.sections || [];
  const sortedSections = [...sections].sort(
    (a: any, b: any) => (a.order || 0) - (b.order || 0)
  );

  // If no sections defined, render a simple default based on available fields
  if (sortedSections.length === 0) {
    return (
      <div>
        <HeroSection
          data={{
            headline: page.title,
            subheadline: page.tagline || "",
            logo: page.content?.logo,
            backgroundImage: page.heroImage || undefined,
          }}
          themeColor={themeColor}
        />
        {page.content?.features && (
          <FeaturesSection
            data={{ items: page.content.features }}
            themeColor={themeColor}
          />
        )}
        {(page.content?.appStoreUrl || page.content?.playStoreUrl) && (
          <DownloadSection
            data={{
              appStoreUrl: page.content.appStoreUrl,
              playStoreUrl: page.content.playStoreUrl,
            }}
            themeColor={themeColor}
          />
        )}
        {page.content?.links && (
          <LinksSection
            data={{ items: page.content.links }}
            themeColor={themeColor}
          />
        )}
      </div>
    );
  }

  const fontUrl = fontFamily
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap`
    : null;

  const wrapperStyle: React.CSSProperties = {
    ...(fontFamily ? { fontFamily: `"${fontFamily}", sans-serif` } : {}),
    ...(darkMode ? { backgroundColor: "#111827", color: "#f9fafb" } : {}),
  };

  return (
    <div style={wrapperStyle}>
      {fontUrl && <link rel="stylesheet" href={fontUrl} />}
      {nav.length > 0 && site && (
        <SiteNav
          rootSlug={site.rootSlug}
          localeSegment={site.localeSegment}
          brand={site.brand}
          logo={site.logo}
          themeColor={themeColor}
          items={nav}
          darkMode={darkMode}
        />
      )}
      {sortedSections.map((section: any, index: number) =>
        renderSection(section, index, themeColor, themeColorSecondary, darkMode, page)
      )}
    </div>
  );
}

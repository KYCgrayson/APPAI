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
import { EmbedSection } from "../sections/EmbedSection";
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
      content = <MediaDownloaderSection data={section.data} themeColor={themeColor} themeColorSecondary={themeColorSecondary} darkMode={darkMode} />;
      break;
    case "tool":
      content = <ToolSection {...props} />;
      break;
    case "pdf-viewer":
      content = <PdfViewerSection {...props} />;
      break;
    case "embed":
      content = <EmbedSection {...props} />;
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

// Re-export NavItem from the canonical location so existing imports keep working.
export type { NavItem } from "@/lib/site-nav";

export function PageRenderer({ page }: { page: PageData }) {
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
      {sortedSections.map((section: any, index: number) =>
        renderSection(section, index, themeColor, themeColorSecondary, darkMode, page)
      )}
    </div>
  );
}

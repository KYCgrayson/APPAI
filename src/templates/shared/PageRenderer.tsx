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

interface PageData {
  template: string;
  title: string;
  tagline?: string | null;
  heroImage?: string | null;
  content: any;
  themeColor?: string | null;
  customCss?: string | null;
}

// Maps section type string to its React component
function renderSection(section: any, index: number, themeColor: string) {
  const props = { key: index, data: section.data, themeColor };

  switch (section.type) {
    case "hero":
      return <HeroSection {...props} />;
    case "video":
      return <VideoSection {...props} />;
    case "features":
      return <FeaturesSection {...props} />;
    case "screenshots":
      return <ScreenshotsSection {...props} />;
    case "download":
      return <DownloadSection {...props} />;
    case "pricing":
      return <PricingSection {...props} />;
    case "testimonials":
      return <TestimonialsSection {...props} />;
    case "faq":
      return <FaqSection {...props} />;
    case "gallery":
      return <GallerySection {...props} />;
    case "team":
      return <TeamSection {...props} />;
    case "schedule":
      return <ScheduleSection {...props} />;
    case "sponsors":
      return <SponsorsSection {...props} />;
    case "stats":
      return <StatsSection {...props} />;
    case "contact":
      return <ContactSection {...props} />;
    case "cta":
      return <CtaSection {...props} />;
    case "links":
      return <LinksSection {...props} />;
    case "about":
      return <AboutSection {...props} />;
    case "action":
      return <ActionSection {...props} />;
    default:
      return null;
  }
}

export function PageRenderer({ page }: { page: PageData }) {
  const themeColor = page.themeColor || "#000000";
  const sections = page.content?.sections || [];
  const sortedSections = [...sections].sort(
    (a: any, b: any) => (a.order || 0) - (b.order || 0)
  );

  // If no sections defined, render a simple default based on available fields
  if (sortedSections.length === 0) {
    return (
      <div className="min-h-screen bg-white">
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
        <footer className="py-8 text-center text-sm text-gray-400 border-t">
          Hosted on AppAI
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {page.customCss && <style>{page.customCss}</style>}

      {sortedSections.map((section: any, index: number) =>
        renderSection(section, index, themeColor)
      )}

      <footer className="py-8 text-center text-sm text-gray-400 border-t">
        Hosted on AppAI
      </footer>
    </div>
  );
}

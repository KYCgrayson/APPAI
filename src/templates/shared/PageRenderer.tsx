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
  slug: string;
  template: string;
  title: string;
  tagline?: string | null;
  heroImage?: string | null;
  content: any;
  themeColor?: string | null;
  customCss?: string | null;
  privacyPolicy?: string | null;
  termsOfService?: string | null;
}

// Maps section type string to its React component
// Each section supports optional backgroundColor and alternating bg for visual rhythm
function renderSection(section: any, index: number, themeColor: string) {
  const props = { data: section.data, themeColor };
  const bg = section.data?.backgroundColor || (index % 2 === 1 ? "#f9fafb" : undefined);

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
      return <CtaSection key={index} {...props} />;
    case "links":
      content = <LinksSection {...props} />;
      break;
    case "about":
      content = <AboutSection {...props} />;
      break;
    case "action":
      content = <ActionSection {...props} />;
      break;
    default:
      return null;
  }

  // Hero section handles its own background
  if (section.type === "hero") {
    return <div key={index}>{content}</div>;
  }

  return (
    <div key={index} style={bg ? { backgroundColor: bg } : undefined}>
      {content}
    </div>
  );
}

function PageFooter({ slug, hasPrivacy, hasTerms }: { slug: string; hasPrivacy: boolean; hasTerms: boolean }) {
  return (
    <footer className="py-8 border-t">
      {(hasPrivacy || hasTerms) && (
        <div className="flex justify-center gap-6 mb-4 text-sm text-gray-500">
          {hasPrivacy && (
            <a href={`/p/${slug}/privacy`} className="hover:text-gray-800">
              Privacy Policy
            </a>
          )}
          {hasTerms && (
            <a href={`/p/${slug}/terms`} className="hover:text-gray-800">
              Terms of Service
            </a>
          )}
        </div>
      )}
      <div className="text-center text-sm text-gray-400">
        <a href="https://appai.info" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
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
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <a href={`/p/${page.slug}`} className="flex items-center gap-3">
          {logo && (
            <img src={logo} alt={page.title} className="w-8 h-8 rounded-lg object-cover" />
          )}
          <span className="font-semibold text-lg">{page.title}</span>
        </a>
        <div className="flex items-center gap-4">
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

export function PageRenderer({
  page,
  nav = [],
}: {
  page: PageData;
  /** Site navigation items. When non-empty, <SiteNav> renders at the top. */
  nav?: NavItem[];
}) {
  // nav is wired into the data flow here so /p/[...segments]/page.tsx can pass
  // multi-page nav data through. Visual rendering of <SiteNav> arrives in
  // task #4. Until then, the prop is accepted but not yet displayed.
  void nav;

  const themeColor = page.themeColor || "#000000";
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

  return (
    <div>
      {sortedSections.map((section: any, index: number) =>
        renderSection(section, index, themeColor)
      )}
    </div>
  );
}

import { GameSection } from "../sections/GameSection";
import { typographyFactors, typographyCss, hasTypography, ROLES, typographySettings } from "@/lib/typography";
import {
  ProfileHeaderSection,
  ProjectCardsSection,
  EntriesSection,
  HeroSection,
  FeaturesSection,
  ScreenshotsSection,
  DownloadSection,
  FaqSection,
  VideoSection,
  PricingSection,
  TestimonialsSection,
  GallerySection,
  TeamSection,
  ScheduleSection,
  SponsorsSection,
  StatsSection,
  ContactSection,
  CtaSection,
  LinksSection,
  AboutSection,
  ActionSection,
  FormSection,
  MediaDownloaderSection,
  ToolSection,
  PdfViewerSection,
  EmbedSection,
  IframeToolSection,
  VideoSubtitleSection,
  SimpleOrderSection,
} from "./section-components";
import { Suspense } from "react";
import { SectionErrorBoundary } from "./SectionErrorBoundary";
import { normalizeHostedContent, orderedHostedSections } from "@/lib/hosted-content";
import { usesEditorialScreenshots } from "@/lib/screenshot-layout";
import { LoginGate } from "./LoginGate";
import { issueIframeToolSession } from "@/lib/iframe-tool-session";
import { decideSectionAccess, sectionWantsIdentity } from "@/lib/iframe-tool-session-contract";

interface PageSectionData extends Record<string, unknown> {
  access?: string;
  backgroundColor?: string;
  description?: string;
  heading?: string;
  id?: string;
}

interface PageSection {
  type: string;
  order?: number;
  id?: string;
  data?: PageSectionData;
}

interface PageContent extends Record<string, unknown> {
  sections?: PageSection[];
  logo?: string;
  features?: unknown;
  appStoreUrl?: string;
  playStoreUrl?: string;
  links?: unknown;
}

/** Who is looking. Sections gate on it; `iframe-tool` can be handed it. */
export interface PageViewer {
  isLoggedIn: boolean;
  isAdmin: boolean;
  userId: string | null;
}

interface PageData {
  id?: string;
  slug: string;
  template: string;
  title: string;
  tagline?: string | null;
  heroImage?: string | null;
  headerLogo?: string | null;
  content: unknown;
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

function asPageContent(value: unknown): PageContent {
  return normalizeHostedContent(value) as PageContent;
}

function autoSecondaryColor(primary: string): string {
  const r = parseInt(primary.slice(1, 3), 16);
  const g = parseInt(primary.slice(3, 5), 16);
  const b = parseInt(primary.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c + (255 - c) * 0.75);
  return `#${blend(r).toString(16).padStart(2, "0")}${blend(g).toString(16).padStart(2, "0")}${blend(b).toString(16).padStart(2, "0")}`;
}

/**
 * Mint the tool's identity, when the section asked for one.
 *
 * This is on the render path rather than behind a fetch so the tool has an
 * identity in its very first request, before any of its own code runs. It costs
 * one HMAC and no I/O. The page is already rendered per-visitor (it reads the
 * session to decide `isLoggedIn`), so a token belonging to one viewer cannot be
 * served to another.
 */
function iframeToolIdentity(
  page: PageData,
  section: PageSection,
  sectionOrder: number,
  viewer: PageViewer,
) {
  if (section.type !== "iframe-tool") return null;
  const src = section.data?.src;
  if (!page.id || typeof src !== "string" || !sectionWantsIdentity(section.data)) return null;
  const grant = issueIframeToolSession({
    src,
    slug: page.slug,
    section: sectionOrder,
    userId: viewer.userId,
  });
  if (!grant) return null;
  return {
    token: grant.token,
    expiresAt: grant.expiresAt.toISOString(),
    pageId: page.id,
    section: sectionOrder,
  };
}

function renderSection(
  section: PageSection,
  index: number,
  themeColor: string,
  themeColorSecondary: string,
  darkMode: boolean,
  page: PageData,
  viewer: PageViewer,
) {
  const renderVersion = asPageContent(page.content).renderVersion;
  const modern = typeof renderVersion === "number" && renderVersion >= 2;
  const data = { ...section.data };
  // These fields were ignored before v2. Never reinterpret existing live content.
  if (!modern) {
    if (!["features", "contact", "links"].includes(section.type)) delete data.subheading;
    if (["pricing", "faq", "video", "download", "testimonials", "gallery", "team", "schedule", "sponsors", "stats", "embed"].includes(section.type)) delete data.heading;
  }
  const props = { renderVersion: modern ? 2 : 1, data: data as never, themeColor, themeColorSecondary, darkMode, isAdmin: viewer.isAdmin, typographyActive: hasTypography(typographySettings(page.content)) };
  const darkBg = darkMode ? "#111827" : undefined;
  const darkBgAlt = darkMode ? "#1f2937" : "#f9fafb";
  const editorial = ["profile-header", "project-cards", "entries"].includes(section.type);
  const bg = section.data?.backgroundColor || (editorial ? undefined : index % 2 === 1 ? darkBgAlt : darkBg);

  let content;
  switch (section.type) {
    case "profile-header":
      content = <ProfileHeaderSection {...props} />;
      break;
    case "project-cards":
      content = <ProjectCardsSection {...props} />;
      break;
    case "entries":
      content = <EntriesSection {...props} />;
      break;
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
      content = <ScreenshotsSection {...props} editorial={usesEditorialScreenshots(asPageContent(page.content).sections || [])} />;
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
      content = <ContactSection {...props} locale={page.locale} />;
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
      content = <MediaDownloaderSection typographyActive={props.typographyActive} data={data as never} themeColor={themeColor} themeColorSecondary={themeColorSecondary} darkMode={darkMode} />;
      break;
    case "video-subtitle":
      content = <VideoSubtitleSection typographyActive={props.typographyActive} data={data as never} themeColor={themeColor} themeColorSecondary={themeColorSecondary} darkMode={darkMode} isAdmin={viewer.isAdmin} />;
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
    case "iframe-tool": {
      const sectionOrder = typeof section.order === "number" ? section.order : index;
      const pagePath = page.parentSlug
        ? `/p/${page.parentSlug}/${page.slug}`
        : `/p/${page.slug}`;
      const fullscreenHref = `${pagePath}/tools/${sectionOrder}`;
      content = (
        <IframeToolSection
          typographyActive={props.typographyActive}
          data={data as never}
          themeColor={themeColor}
          darkMode={darkMode}
          locale={page.locale ?? "en"}
          fullscreenHref={fullscreenHref}
          identity={iframeToolIdentity(page, section, sectionOrder, viewer)}
        />
      );
      break;
    }
    case "game": {
      const sectionOrder = typeof section.order === "number" ? section.order : index;
      content = <GameSection title={page.title} data={data as never} themeColor={themeColor} darkMode={darkMode} locale={page.locale ?? "en"} typographyActive={props.typographyActive} identity={iframeToolIdentity(page, section, sectionOrder, viewer)} />;
      break;
    }
    case "form":
      content = (
        <FormSection
          typographyActive={props.typographyActive}
          data={data as never}
          themeColor={themeColor}
          pageSlug={page.slug}
          parentSlug={page.parentSlug ?? null}
          locale={page.locale ?? "en"}
          sectionOrder={section.order}
        />
      );
      break;
    case "simple-order": {
      const {
        notificationEmail,
        ...publicData
      } = data as Record<string, unknown> & { notificationEmail?: string };
      content = (
        <SimpleOrderSection
          typographyActive={props.typographyActive}
          data={{
            ...publicData,
            isConfigured: Boolean(notificationEmail && publicData.paymentUrl),
          } as never}
          themeColor={themeColor}
          darkMode={darkMode}
          pageSlug={page.slug}
          parentSlug={page.parentSlug ?? null}
          locale={page.locale ?? "en"}
          sectionOrder={section.order}
        />
      );
      break;
    }
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

// /p is dynamically rendered via auth(): errored RSC chunks reach the client
// boundary. This catch only covers synchronous section setup (e.g. identity).
function SafeSection({ section, index, themeColor, themeColorSecondary, darkMode, page, viewer }: {
  section: PageSection; index: number; themeColor: string; themeColorSecondary: string;
  darkMode: boolean; page: PageData; viewer: PageViewer;
}) {
  try {
    return renderSection(section, index, themeColor, themeColorSecondary, darkMode, page, viewer);
  } catch {
    console.error("Hosted section failed:", section.type);
    return null;
  }
}

// Re-export NavItem from the canonical location so existing imports keep working.
export type { NavItem } from "@/lib/site-nav";

export function PageRenderer({
  page,
  isLoggedIn = false,
  isAdmin = false,
  userId = null,
}: {
  page: PageData;
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  userId?: string | null;
}) {
  const viewer: PageViewer = { isLoggedIn, isAdmin, userId };
  const themeColor = page.themeColor || "#000000";
  const themeColorSecondary = page.themeColorSecondary || autoSecondaryColor(themeColor);
  const darkMode = page.darkMode ?? false;
  const fontFamily = page.fontFamily || undefined;
  const pageContent = asPageContent(page.content);
  const sortedSections: PageSection[] = orderedHostedSections(page.content);

  // Legacy content uses the same guarded path as explicit sections.
  if (sortedSections.length === 0 && page.template !== "GAME") {
    sortedSections.push({ type: "hero", data: { headline: page.title, subheadline: page.tagline || "", logo: pageContent.logo, backgroundImage: page.heroImage || undefined } });
    if (Array.isArray(pageContent.features)) sortedSections.push({ type: "features", data: { items: pageContent.features } });
    if (pageContent.appStoreUrl || pageContent.playStoreUrl) sortedSections.push({ type: "download", data: { appStoreUrl: pageContent.appStoreUrl, playStoreUrl: pageContent.playStoreUrl } });
    if (Array.isArray(pageContent.links)) sortedSections.push({ type: "links", data: { items: pageContent.links } });
  }

  const fontUrl = fontFamily
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap`
    : null;

  const settings = typographySettings(pageContent);
  const activeTypography = hasTypography(settings);
  const scale = activeTypography ? typographyFactors(settings) : null;
  const typographyVars = scale ? Object.fromEntries(ROLES.map(role => [`--ts-${role}`, scale.desktop[role]])) : {};
  const wrapperStyle: React.CSSProperties = {
    ...typographyVars,
    ...(fontFamily ? { fontFamily: `"${fontFamily}", sans-serif` } : {}),
    ...(darkMode ? { backgroundColor: "#111827", color: "#f9fafb" } : {}),
  };

  return (
    <div style={wrapperStyle} data-dark={darkMode} data-typography={activeTypography ? "active" : undefined}>
      {activeTypography && <style>{typographyCss(settings)}</style>}
      {fontUrl && <link rel="stylesheet" href={fontUrl} />}
      {page.template === "GAME" && <header className="mx-auto max-w-5xl px-4 sm:px-6 pt-10 break-words"><h1 className="text-3xl sm:text-5xl font-bold mb-4" data-typography-role={activeTypography ? "display" : undefined}>{page.title}</h1>{page.tagline && <p className="text-lg">{page.tagline}</p>}</header>}
      {sortedSections.map((section, index) => {
        // Gating primitive: a section may declare data.access="login" or
        // "admin". Either way the section keeps its place on the page and a
        // card explains the wall — the hero and FAQ around it are already
        // describing this tool, so a gap where it should be reads as broken
        // rather than closed.
        const decision = decideSectionAccess(section.data?.access, viewer);
        if (decision !== "render") {
          const path = page.parentSlug
            ? `/p/${page.parentSlug}/${page.slug}`
            : `/p/${page.slug}`;
          // Carry the section's anchor id so in-page CTAs (#subtitle) still
          // scroll here when the tool is replaced by the gate.
          return (
            <div key={index} id={section.data?.id || undefined}>
              <LoginGate
                mode={decision}
                redirectTo={path}
                heading={section.data?.heading || page.title}
                description={section.data?.description || page.tagline || undefined}
                themeColor={themeColor}
                locale={page.locale ?? "en"}
              />
            </div>
          );
        }
        return <SectionErrorBoundary key={index} sectionType={section.type}>
          <Suspense fallback={null}>
            <SafeSection section={section} index={index} themeColor={themeColor} themeColorSecondary={themeColorSecondary} darkMode={darkMode} page={page} viewer={viewer} />
          </Suspense>
        </SectionErrorBoundary>;
      })}
    </div>
  );
}

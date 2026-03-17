import { HeroSection } from "./sections/HeroSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { ScreenshotsSection } from "./sections/ScreenshotsSection";
import { DownloadSection } from "./sections/DownloadSection";
import { FaqSection } from "./sections/FaqSection";

interface Props {
  title: string;
  tagline?: string;
  heroImage?: string;
  content: any;
  themeColor: string;
}

export function AppLandingPage({ title, tagline, heroImage, content, themeColor }: Props) {
  const sections = content?.sections || [];
  const sortedSections = [...sections].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  return (
    <div className="min-h-screen bg-white" style={{ "--theme-color": themeColor } as any}>
      {sortedSections.length === 0 ? (
        <>
          <HeroSection
            data={{
              headline: title,
              subheadline: tagline || "",
              backgroundImage: heroImage,
            }}
            themeColor={themeColor}
          />
          {content?.features && (
            <FeaturesSection data={{ items: content.features }} themeColor={themeColor} />
          )}
          {content?.appStoreUrl || content?.playStoreUrl ? (
            <DownloadSection
              data={{
                appStoreUrl: content.appStoreUrl,
                playStoreUrl: content.playStoreUrl,
              }}
              themeColor={themeColor}
            />
          ) : null}
        </>
      ) : (
        sortedSections.map((section: any, index: number) => {
          switch (section.type) {
            case "hero":
              return <HeroSection key={index} data={section.data} themeColor={themeColor} />;
            case "features":
              return <FeaturesSection key={index} data={section.data} themeColor={themeColor} />;
            case "screenshots":
              return <ScreenshotsSection key={index} data={section.data} themeColor={themeColor} />;
            case "download":
              return <DownloadSection key={index} data={section.data} themeColor={themeColor} />;
            case "faq":
              return <FaqSection key={index} data={section.data} themeColor={themeColor} />;
            case "custom":
              return (
                <section key={index} className="py-16 px-6 max-w-4xl mx-auto">
                  <div className="prose prose-lg max-w-none whitespace-pre-wrap text-gray-600">
                    {section.data?.text || section.data?.html || ""}
                  </div>
                </section>
              );
            default:
              return null;
          }
        })
      )}

      <footer className="py-8 text-center text-sm text-gray-400 border-t">
        Hosted on AppAI
      </footer>
    </div>
  );
}

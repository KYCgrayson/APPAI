import { LegacyDownloadSection } from "./LegacyDownloadSection";
import { sanitizeSocialUrl } from "@/lib/sanitize";
import { StoreBadges } from "@/templates/shared/StoreBadges";

interface Props {
  data: {
    subheading?: string;
    heading?: string;
    appStoreUrl?: string;
    playStoreUrl?: string;
    ctaText?: string;
  };
  themeColor: string;
}

export function DownloadSection({ data, themeColor, typographyActive = false, renderVersion = 1 }: Props & { typographyActive?: boolean; renderVersion?: number }) {
  if (renderVersion < 2) return <LegacyDownloadSection data={data} themeColor={themeColor} typographyActive={typographyActive} />;
  const urls = [data.appStoreUrl, data.playStoreUrl].map(url => sanitizeSocialUrl(url || "")).filter(url => url !== "#");
  const appStoreUrl = urls.find(url => new URL(url).hostname === "apps.apple.com");
  const playStoreUrl = urls.find(url => new URL(url).hostname === "play.google.com");
  if (!urls.length) return null;

  return (
    <section id="download" className="py-12 md:py-20 px-4 sm:px-6 text-center" style={{ backgroundColor: themeColor }}>
      <div className="max-w-2xl mx-auto">
        <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-8">
          {data.heading || data.ctaText || "Download Now"}
        </h2>
        {data.subheading && <p className="text-center text-white mb-6">{data.subheading}</p>}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {urls.filter(url => url !== appStoreUrl && url !== playStoreUrl).map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-block px-8 py-4 rounded-xl bg-black text-white">{data.ctaText || "Download Now"}</a>)}
          <StoreBadges appStoreUrl={appStoreUrl} playStoreUrl={playStoreUrl} typographyActive={typographyActive} />
        </div>
      </div>
    </section>
  );
}

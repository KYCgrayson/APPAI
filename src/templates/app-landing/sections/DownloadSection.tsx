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

export function DownloadSection({ data, themeColor, typographyActive = false }: Props & { typographyActive?: boolean }) {
  if (!data.appStoreUrl && !data.playStoreUrl) return null;

  return (
    <section id="download" className="py-12 md:py-20 px-4 sm:px-6 text-center" style={{ backgroundColor: themeColor }}>
      <div className="max-w-2xl mx-auto">
        <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-8">
          {data.heading ?? data.ctaText ?? "Download Now"}
        </h2>
        {data.subheading && <p className="text-center mb-6">{data.subheading}</p>}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <StoreBadges appStoreUrl={data.appStoreUrl} playStoreUrl={data.playStoreUrl} typographyActive={typographyActive} />
        </div>
      </div>
    </section>
  );
}

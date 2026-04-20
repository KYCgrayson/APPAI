import { sanitizeUrl } from "@/lib/sanitize";
import { Prose } from "@/templates/shared/Prose";

interface Props {
  data: {
    headline: string;
    subheadline?: string;
    buttonText: string;
    buttonUrl: string;
    rel?: string; // e.g. "nofollow", "sponsored", "nofollow sponsored"
  };
  themeColor: string;
}

export function CtaSection({ data, themeColor }: Props) {
  const safeUrl = sanitizeUrl(data.buttonUrl);
  const isExternal = /^https?:\/\//i.test(safeUrl);
  const relParts = isExternal ? ["noopener", "noreferrer"] : [];
  if (data.rel) relParts.push(...data.rel.split(/\s+/).filter(Boolean));
  const relAttr = relParts.length > 0 ? Array.from(new Set(relParts)).join(" ") : undefined;
  return (
    <section className="py-12 md:py-20 px-4 sm:px-6" style={{ backgroundColor: themeColor }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
          {data.headline}
        </h2>
        {data.subheadline && (
          <Prose className="prose prose-sm md:prose-base max-w-none text-white/80 mb-8 prose-a:text-white prose-a:underline prose-headings:font-semibold prose-headings:text-white prose-strong:text-white">{data.subheadline}</Prose>
        )}
        <a
          href={safeUrl}
          target={isExternal ? "_blank" : undefined}
          rel={relAttr}
          className="inline-block px-8 py-4 rounded-full bg-white font-semibold text-lg transition-transform hover:scale-105"
          style={{ color: themeColor }}
        >
          {data.buttonText}
        </a>
      </div>
    </section>
  );
}

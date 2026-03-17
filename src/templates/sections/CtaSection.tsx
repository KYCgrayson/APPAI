import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    headline: string;
    subheadline?: string;
    buttonText: string;
    buttonUrl: string;
  };
  themeColor: string;
}

export function CtaSection({ data, themeColor }: Props) {
  return (
    <section className="py-20 px-6" style={{ backgroundColor: themeColor }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {data.headline}
        </h2>
        {data.subheadline && (
          <p className="text-lg text-white/80 mb-8">{data.subheadline}</p>
        )}
        <a
          href={sanitizeUrl(data.buttonUrl)}
          className="inline-block px-8 py-4 rounded-full bg-white font-semibold text-lg transition-transform hover:scale-105"
          style={{ color: themeColor }}
        >
          {data.buttonText}
        </a>
      </div>
    </section>
  );
}

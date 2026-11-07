import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    subheading?: string;
    heading?: string;
    items: Array<{
      name: string;
      logo: string;
      url?: string;
    }>;
  };
  themeColor: string;
}

export function SponsorsSection({ data, themeColor, typographyActive = false }: Props & { typographyActive?: boolean }) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          {data.heading ?? "Sponsors"}
        </h2>
        {data.subheading && <p className="text-center mb-6">{data.subheading}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 items-center">
          {items.map((item, i) => {
            const content = (
              <img
                src={sanitizeUrl(item.logo)}
                alt={item.name}
                className="max-h-16 w-auto mx-auto grayscale hover:grayscale-0 transition-all opacity-70 hover:opacity-100"
              />
            );

            return item.url ? (
              <a data-typography-role={typographyActive ? "body" : undefined} key={i} href={sanitizeUrl(item.url)} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            ) : (
              <div key={i}>{content}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

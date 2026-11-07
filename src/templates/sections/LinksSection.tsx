import { sanitizeUrl } from "@/lib/sanitize";
import { SmartIcon } from "@/templates/shared/SmartIcon";

interface Props {
  data: {
    heading?: string;
    subheading?: string;
    items: Array<{
      title: string;
      url: string;
      icon?: string;
      style?: "filled" | "outlined";
      rel?: string; // e.g. "nofollow", "sponsored", "nofollow sponsored"
    }>;
  };
  themeColor: string;
}

export function LinksSection({ data, themeColor, typographyActive = false }: Props & { typographyActive?: boolean }) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-md mx-auto space-y-4">
        {data.heading && <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl font-bold text-center" style={{ color: themeColor }}>{data.heading}</h2>}
        {data.subheading && <p data-typography-role={typographyActive ? "body" : undefined} className="text-center text-gray-600">{data.subheading}</p>}
        {items.map((item, i) => {
          const safeUrl = sanitizeUrl(item.url);
          const isExternal = /^https?:\/\//i.test(safeUrl);
          const relParts = isExternal ? ["noopener", "noreferrer"] : [];
          if (typeof item.rel === "string") relParts.push(...item.rel.split(/\s+/).filter(Boolean));
          const relAttr = relParts.length > 0 ? Array.from(new Set(relParts)).join(" ") : undefined;
          return (
          <a data-typography-role={typographyActive ? "card" : undefined}
            key={i}
            href={safeUrl}
            target={isExternal ? "_blank" : undefined}
            rel={relAttr}
            className="block w-full text-center px-6 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-105"
            style={
              item.style === "outlined"
                ? { border: `2px solid ${themeColor}`, color: themeColor }
                : { backgroundColor: themeColor, color: "#fff" }
            }
          >
            {item.icon && <SmartIcon value={item.icon} className="mr-2 inline-flex" size="1.25em" />}
            {item.title}
          </a>
          );
        })}
      </div>
    </section>
  );
}

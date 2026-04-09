import { sanitizeUrl } from "@/lib/sanitize";
import { SmartIcon } from "@/templates/shared/SmartIcon";

interface Props {
  data: {
    items: Array<{
      title: string;
      url: string;
      icon?: string;
      style?: "filled" | "outlined";
    }>;
  };
  themeColor: string;
}

export function LinksSection({ data, themeColor }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-md mx-auto space-y-4">
        {items.map((item, i) => {
          const safeUrl = sanitizeUrl(item.url);
          const isExternal = /^https?:\/\//i.test(safeUrl);
          return (
          <a
            key={i}
            href={safeUrl}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
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

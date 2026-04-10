import { sanitizeUrl } from "@/lib/sanitize";
import { Prose } from "@/templates/shared/Prose";

interface Props {
  data: {
    items: Array<{
      name: string;
      price: string;
      description?: string;
      features: string[];
      highlighted?: boolean;
      ctaText?: string;
      ctaUrl?: string;
    }>;
  };
  themeColor: string;
}

export function PricingSection({ data, themeColor }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          Pricing
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {items.map((item, i) => (
            <div
              key={i}
              className={`relative bg-white rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow ${
                item.highlighted ? "border-2" : "border border-gray-100"
              }`}
              style={item.highlighted ? { borderColor: themeColor } : undefined}
            >
              {item.highlighted && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-xs font-semibold"
                  style={{ backgroundColor: themeColor }}
                >
                  Recommended
                </span>
              )}
              <h3 className="text-xl font-semibold mb-2">{item.name}</h3>
              <p className="text-4xl font-bold mb-4" style={{ color: themeColor }}>
                {item.price}
              </p>
              {item.description && (
                <Prose className="prose prose-sm max-w-none text-gray-500 mb-6 prose-a:text-blue-600 hover:prose-a:underline prose-headings:font-semibold">{item.description}</Prose>
              )}
              <ul className="space-y-3 mb-8">
                {item.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-2 text-gray-600">
                    <span style={{ color: themeColor }}>&#10003;</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {item.ctaText && (
                <a
                  href={sanitizeUrl(item.ctaUrl || "#")}
                  className="block text-center px-6 py-3 rounded-full font-semibold transition-transform hover:scale-105"
                  style={
                    item.highlighted
                      ? { backgroundColor: themeColor, color: "#fff" }
                      : { border: `2px solid ${themeColor}`, color: themeColor }
                  }
                >
                  {item.ctaText}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

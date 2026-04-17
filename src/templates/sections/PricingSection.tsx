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
  themeColorSecondary?: string;
  darkMode?: boolean;
}

// Parse "free", "$29", "$29/mo", "NT$500", "€10" into { amount, currency }.
// Agents write pricing strings in whatever format they like, so this is a
// best-effort extractor — when parsing fails we omit priceSpecification and
// just emit the raw text, which Google still accepts.
function parsePrice(raw: string): { amount: string; currency: string } | null {
  const text = raw.trim();
  if (/^free$/i.test(text) || /^0(\.0+)?$/.test(text)) {
    return { amount: "0", currency: "USD" };
  }
  const currencyMap: Record<string, string> = {
    $: "USD",
    "US$": "USD",
    "NT$": "TWD",
    "HK$": "HKD",
    "CA$": "CAD",
    "A$": "AUD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₩": "KRW",
    "₹": "INR",
  };
  for (const [symbol, code] of Object.entries(currencyMap)) {
    if (text.startsWith(symbol)) {
      const rest = text.slice(symbol.length);
      const amount = rest.match(/^([\d.,]+)/)?.[1]?.replace(/,/g, "");
      if (amount) return { amount, currency: code };
    }
  }
  const bareNumber = text.match(/^([\d.,]+)\s*(USD|TWD|EUR|GBP|JPY|HKD|KRW|INR|CAD|AUD)?/i);
  if (bareNumber?.[1]) {
    return {
      amount: bareNumber[1].replace(/,/g, ""),
      currency: (bareNumber[2] || "USD").toUpperCase(),
    };
  }
  return null;
}

export function PricingSection({ data, themeColor, darkMode }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  const offers = items.map((item) => {
    const parsed = parsePrice(item.price);
    const offer: Record<string, any> = {
      "@type": "Offer",
      name: item.name,
      description: item.description || undefined,
      category: item.name,
    };
    if (parsed) {
      offer.price = parsed.amount;
      offer.priceCurrency = parsed.currency;
    } else {
      offer.priceSpecification = {
        "@type": "PriceSpecification",
        description: item.price,
      };
    }
    if (item.ctaUrl) offer.url = item.ctaUrl;
    return offer;
  });

  const offerSchema = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Pricing",
    itemListElement: offers,
  };

  return (
    <section className={`py-12 md:py-20 px-4 sm:px-6 ${darkMode ? "" : "bg-gray-50"}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(offerSchema) }}
      />
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          Pricing
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {items.map((item, i) => (
            <div
              key={i}
              className={`relative rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow ${
                darkMode ? "bg-gray-800" : "bg-white"
              } ${
                item.highlighted ? "border-2" : `border ${darkMode ? "border-gray-700" : "border-gray-100"}`
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
              <h3 className={`text-xl font-semibold mb-2 ${darkMode ? "text-gray-100" : ""}`}>{item.name}</h3>
              <p className="text-4xl font-bold mb-4" style={{ color: themeColor }}>
                {item.price}
              </p>
              {item.description && (
                <Prose className="prose prose-sm max-w-none text-gray-500 mb-6 prose-a:text-blue-600 hover:prose-a:underline prose-headings:font-semibold">{item.description}</Prose>
              )}
              <ul className="space-y-3 mb-8">
                {item.features.map((feature, j) => (
                  <li key={j} className={`flex items-start gap-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
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

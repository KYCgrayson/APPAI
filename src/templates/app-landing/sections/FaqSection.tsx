import { Prose } from "@/templates/shared/Prose";

interface Props {
  data: {
    items?: Array<{
      question: string;
      answer: string;
    }>;
  };
  themeColor: string;
  themeColorSecondary?: string;
  darkMode?: boolean;
}

// Strip minimal markdown so the JSON-LD answer text is clean for LLMs.
function stripMarkdown(input: string): string {
  return input
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function FaqSection({ data, themeColor, darkMode }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripMarkdown(item.answer),
      },
    })),
  };

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          FAQ
        </h2>
        <div className="space-y-4 md:space-y-6">
          {items.map((item, i) => (
            <details key={i} className={`group border rounded-xl p-5 md:p-6 ${darkMode ? "border-gray-700" : ""}`}>
              <summary className={`font-semibold text-base md:text-lg cursor-pointer list-none flex justify-between items-center gap-4 ${darkMode ? "text-gray-100" : ""}`}>
                {item.question}
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <Prose className={`prose prose-sm md:prose-base max-w-none mt-4 leading-relaxed prose-a:text-blue-600 hover:prose-a:underline prose-headings:font-semibold ${darkMode ? "text-gray-400 prose-headings:text-gray-200" : "text-gray-600"}`}>{item.answer}</Prose>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

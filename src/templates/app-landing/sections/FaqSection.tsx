import { Prose } from "@/templates/shared/Prose";

interface Props {
  data: {
    items?: Array<{
      question: string;
      answer: string;
    }>;
  };
  themeColor: string;
}

export function FaqSection({ data, themeColor }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          FAQ
        </h2>
        <div className="space-y-4 md:space-y-6">
          {items.map((item, i) => (
            <details key={i} className="group border rounded-xl p-5 md:p-6">
              <summary className="font-semibold text-base md:text-lg cursor-pointer list-none flex justify-between items-center gap-4">
                {item.question}
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <Prose className="prose prose-sm md:prose-base max-w-none mt-4 text-gray-600 leading-relaxed prose-a:text-blue-600 hover:prose-a:underline prose-headings:font-semibold">{item.answer}</Prose>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

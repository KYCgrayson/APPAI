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
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16" style={{ color: themeColor }}>
          FAQ
        </h2>
        <div className="space-y-6">
          {items.map((item, i) => (
            <details key={i} className="group border rounded-xl p-6">
              <summary className="font-semibold text-lg cursor-pointer list-none flex justify-between items-center">
                {item.question}
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <p className="mt-4 text-gray-600 leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

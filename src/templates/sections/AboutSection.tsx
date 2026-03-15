interface Props {
  data: {
    heading?: string;
    text: string;
  };
  themeColor: string;
}

export function AboutSection({ data, themeColor }: Props) {
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        {data.heading && (
          <h2 className="text-3xl font-bold text-center mb-8" style={{ color: themeColor }}>
            {data.heading}
          </h2>
        )}
        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{data.text}</p>
      </div>
    </section>
  );
}

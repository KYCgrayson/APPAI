interface Props {
  data: {
    items: Array<{
      value: string;
      label: string;
    }>;
  };
  themeColor: string;
}

export function StatsSection({ data, themeColor }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {items.map((item, i) => (
            <div key={i} className="text-center">
              <p className="text-4xl md:text-5xl font-bold" style={{ color: themeColor }}>
                {item.value}
              </p>
              <p className="text-gray-500 mt-2 text-sm uppercase tracking-wide">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface Props {
  data: {
    items: Array<{
      value: string;
      label: string;
    }>;
  };
  themeColor: string;
  themeColorSecondary?: string;
  darkMode?: boolean;
}

export function StatsSection({ data, themeColor, darkMode }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {items.map((item, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl md:text-5xl font-bold" style={{ color: themeColor }}>
                {item.value}
              </p>
              <p className={`mt-2 text-sm uppercase tracking-wide ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

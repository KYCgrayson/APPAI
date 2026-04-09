interface Props {
  data: {
    items: Array<{
      time: string;
      title: string;
      description?: string;
      speaker?: string;
    }>;
  };
  themeColor: string;
}

export function ScheduleSection({ data, themeColor }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          Schedule
        </h2>
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-4 top-0 bottom-0 w-0.5"
            style={{ backgroundColor: themeColor, opacity: 0.2 }}
          />
          <div className="space-y-8">
            {items.map((item, i) => (
              <div key={i} className="relative pl-12 break-words">
                {/* Dot */}
                <div
                  className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full"
                  style={{ backgroundColor: themeColor }}
                />
                <p className="text-sm font-semibold" style={{ color: themeColor }}>
                  {item.time}
                </p>
                <h3 className="text-base md:text-lg font-semibold mt-1">{item.title}</h3>
                {item.speaker && (
                  <p className="text-sm text-gray-400 mt-1">{item.speaker}</p>
                )}
                {item.description && (
                  <p className="text-gray-600 mt-2 text-sm md:text-base">{item.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

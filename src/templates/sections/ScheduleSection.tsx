import { Prose } from "@/templates/shared/Prose";

interface Props {
  data: {
    subheading?: string;
    heading?: string;
    items: Array<{
      time: string;
      title: string;
      description?: string;
      speaker?: string;
    }>;
  };
  themeColor: string;
}

export function ScheduleSection({ data, themeColor, typographyActive = false }: Props & { typographyActive?: boolean }) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          {data.heading ?? "Schedule"}
        </h2>
        {data.subheading && <p className="text-center mb-6">{data.subheading}</p>}
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
                <p data-typography-role={typographyActive ? "caption" : undefined} className="text-sm font-semibold" style={{ color: themeColor }}>
                  {item.time}
                </p>
                <h3 data-typography-role={typographyActive ? "card" : undefined} className="text-base md:text-lg font-semibold mt-1">{item.title}</h3>
                {item.speaker && (
                  <p data-typography-role={typographyActive ? "caption" : undefined} className="text-sm text-gray-400 mt-1">{item.speaker}</p>
                )}
                {item.description && (
                  <Prose typographyRole={typographyActive ? "body" : undefined} className="prose prose-sm md:prose-base max-w-none text-gray-600 mt-2 prose-a:text-blue-600 hover:prose-a:underline prose-headings:font-semibold">{item.description}</Prose>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

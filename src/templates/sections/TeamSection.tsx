import { sanitizeUrl } from "@/lib/sanitize";
import { Prose } from "@/templates/shared/Prose";

interface Props {
  data: {
    subheading?: string;
    heading?: string;
    items: Array<{
      name: string;
      role: string;
      photo?: string;
      bio?: string;
    }>;
  };
  themeColor: string;
  darkMode?: boolean;
}

function getInitials(name: string): string {
  return (typeof name === "string" ? name : "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TeamSection({ data, themeColor, darkMode, typographyActive = false }: Props & { typographyActive?: boolean }) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          {data.heading ?? "Our Team"}
        </h2>
        {data.subheading && <p className="text-center mb-6">{data.subheading}</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {items.map((item, i) => (
            <div key={i} className={`rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-center border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
              {item.photo ? (
                <img
                  src={sanitizeUrl(item.photo)}
                  alt={item.name}
                  className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-semibold mx-auto mb-4"
                  style={{ backgroundColor: themeColor }}
                >
                  {getInitials(item.name)}
                </div>
              )}
              <h3 data-typography-role={typographyActive ? "card" : undefined} className="text-lg font-semibold">{item.name}</h3>
              <p data-typography-role={typographyActive ? "caption" : undefined} className="text-sm mb-2" style={{ color: themeColor }}>
                {item.role}
              </p>
              {item.bio && <Prose typographyRole={typographyActive ? "card" : undefined} className={`prose prose-sm max-w-none ${darkMode ? "text-gray-300" : "text-gray-500"}`}>{item.bio}</Prose>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

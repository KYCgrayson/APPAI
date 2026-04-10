import { sanitizeUrl } from "@/lib/sanitize";
import { Prose } from "@/templates/shared/Prose";

interface Props {
  data: {
    items: Array<{
      name: string;
      role: string;
      photo?: string;
      bio?: string;
    }>;
  };
  themeColor: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TeamSection({ data, themeColor }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          Our Team
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-center border border-gray-100">
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
              <h3 className="text-lg font-semibold">{item.name}</h3>
              <p className="text-sm mb-2" style={{ color: themeColor }}>
                {item.role}
              </p>
              {item.bio && <Prose className="prose prose-sm max-w-none text-gray-500 prose-a:text-blue-600 hover:prose-a:underline prose-headings:font-semibold">{item.bio}</Prose>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

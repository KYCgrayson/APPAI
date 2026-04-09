import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    items: Array<{
      name: string;
      role?: string;
      avatar?: string;
      quote: string;
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

export function TestimonialsSection({ data, themeColor }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          Testimonials
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <p className="text-gray-600 leading-relaxed mb-6 text-sm md:text-base">&ldquo;{item.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                {item.avatar ? (
                  <img
                    src={sanitizeUrl(item.avatar)}
                    alt={item.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                    style={{ backgroundColor: themeColor }}
                  >
                    {getInitials(item.name)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{item.name}</p>
                  {item.role && <p className="text-gray-400 text-xs">{item.role}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

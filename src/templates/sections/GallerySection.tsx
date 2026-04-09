import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    items: Array<{
      url: string;
      caption?: string;
      type?: "image" | "video";
    }>;
  };
  themeColor: string;
}

export function GallerySection({ data, themeColor }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          Gallery
        </h2>
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {items.map((item, i) => (
            <div key={i} className="break-inside-avoid rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {item.type === "video" ? (
                <video className="w-full" controls>
                  <source src={sanitizeUrl(item.url)} />
                </video>
              ) : (
                <img
                  src={sanitizeUrl(item.url)}
                  alt={item.caption || `Gallery item ${i + 1}`}
                  className="w-full"
                />
              )}
              {item.caption && (
                <p className="text-sm text-gray-500 p-3">{item.caption}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

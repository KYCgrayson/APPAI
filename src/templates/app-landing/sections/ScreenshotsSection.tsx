import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    images?: string[];
  };
  themeColor: string;
}

export function ScreenshotsSection({ data, themeColor }: Props) {
  const images = data.images || [];
  if (images.length === 0) return null;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          Screenshots
        </h2>
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6">
          {images.map((url, i) => (
            <div key={i} className="flex-shrink-0 snap-center">
              <img
                src={sanitizeUrl(url)}
                alt={`Screenshot ${i + 1}`}
                className="rounded-2xl shadow-lg h-[360px] md:h-[500px] w-auto object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

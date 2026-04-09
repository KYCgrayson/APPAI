import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    headline?: string;
    subheadline?: string;
    logo?: string;
    ctaText?: string;
    ctaUrl?: string;
    backgroundImage?: string;
    backgroundVideo?: string;
  };
  themeColor: string;
}

export function HeroSection({ data, themeColor }: Props) {
  const hasBackground = data.backgroundImage || data.backgroundVideo;

  return (
    <section
      className="relative min-h-[70vh] flex items-center justify-center text-center px-4 sm:px-6 py-16"
      style={{
        backgroundImage: !data.backgroundVideo && data.backgroundImage ? `url(${sanitizeUrl(data.backgroundImage)})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {data.backgroundVideo && (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={sanitizeUrl(data.backgroundVideo)}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      {hasBackground && (
        <div className="absolute inset-0 bg-black/50" />
      )}
      <div className="relative z-10 max-w-3xl">
        {data.logo && (
          <img src={sanitizeUrl(data.logo)} alt="Logo" className="h-16 w-16 mx-auto mb-6 rounded-2xl object-cover" />
        )}
        <h1
          className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 break-words"
          style={{ color: hasBackground ? "#fff" : themeColor }}
        >
          {data.headline || "Welcome"}
        </h1>
        {data.subheadline && (
          <p className={`text-lg sm:text-xl md:text-2xl mb-8 ${hasBackground ? "text-gray-200" : "text-gray-600"}`}>
            {data.subheadline}
          </p>
        )}
        {data.ctaText && (
          <a
            href={sanitizeUrl(data.ctaUrl || "#download")}
            className="inline-block px-8 py-4 rounded-full text-white font-semibold text-lg transition-transform hover:scale-105"
            style={{ backgroundColor: themeColor }}
          >
            {data.ctaText}
          </a>
        )}
      </div>
    </section>
  );
}

import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    headline?: string;
    subheadline?: string;
    logo?: string;
    ctaText?: string;
    ctaUrl?: string;
    ctaSecondaryText?: string;
    ctaSecondaryUrl?: string;
    backgroundImage?: string;
    backgroundVideo?: string;
    backgroundColor?: string;
    variant?: "centered" | "split" | "minimal";
    heroHeight?: "full" | "large" | "medium" | "small";
  };
  themeColor: string;
  themeColorSecondary?: string;
  darkMode?: boolean;
}

const HEIGHT_MAP: Record<string, string> = {
  full: "min-h-screen",
  large: "min-h-[70vh]",
  medium: "min-h-[50vh]",
  small: "min-h-[35vh]",
};

function isColorDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

export function HeroSection({ data, themeColor, themeColorSecondary, darkMode }: Props) {
  const hasMedia = data.backgroundImage || data.backgroundVideo;
  const hasBg = hasMedia || data.backgroundColor;
  const isDark = hasBg
    ? (data.backgroundColor ? isColorDark(data.backgroundColor) : true)
    : (darkMode ?? false);
  const variant = data.variant || "centered";
  const heightClass = HEIGHT_MAP[data.heroHeight || "large"];

  if (variant === "split") {
    return (
      <section
        className={`${heightClass} flex items-center px-4 sm:px-6 py-16`}
        style={{ backgroundColor: data.backgroundColor || (darkMode ? "#111827" : undefined) }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center w-full">
          <div>
            {data.logo && (
              <img src={sanitizeUrl(data.logo)} alt="Logo" className="h-16 w-16 mb-6 rounded-2xl object-cover" />
            )}
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 break-words"
              style={{ color: isDark ? "#fff" : themeColor }}
            >
              {data.headline || "Welcome"}
            </h1>
            {data.subheadline && (
              <p className={`text-lg sm:text-xl mb-8 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                {data.subheadline}
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              {data.ctaText && (
                <a
                  href={sanitizeUrl(data.ctaUrl || "#download")}
                  className="inline-block px-8 py-4 rounded-full text-white font-semibold text-lg transition-transform hover:scale-105"
                  style={{ backgroundColor: themeColor }}
                >
                  {data.ctaText}
                </a>
              )}
              {data.ctaSecondaryText && (
                <a
                  href={sanitizeUrl(data.ctaSecondaryUrl || "#")}
                  className="inline-block px-8 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-105 border-2"
                  style={{ borderColor: themeColorSecondary || themeColor, color: isDark ? "#fff" : themeColor }}
                >
                  {data.ctaSecondaryText}
                </a>
              )}
            </div>
          </div>
          {data.backgroundImage && (
            <div className="flex justify-center">
              <img
                src={sanitizeUrl(data.backgroundImage)}
                alt=""
                className="rounded-2xl shadow-2xl max-h-[500px] w-auto object-cover"
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  if (variant === "minimal") {
    return (
      <section
        className={`flex items-center justify-center text-center px-4 sm:px-6 py-20 md:py-32 ${data.heroHeight ? heightClass : ""}`}
        style={{ backgroundColor: data.backgroundColor || (darkMode ? "#111827" : undefined) }}
      >
        <div className="max-w-3xl">
          {data.logo && (
            <img src={sanitizeUrl(data.logo)} alt="Logo" className="h-12 w-12 mx-auto mb-6 rounded-xl object-cover" />
          )}
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 break-words"
            style={{ color: isDark ? "#fff" : themeColor }}
          >
            {data.headline || "Welcome"}
          </h1>
          {data.subheadline && (
            <p className={`text-base sm:text-lg mb-6 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              {data.subheadline}
            </p>
          )}
          {data.ctaText && (
            <a
              href={sanitizeUrl(data.ctaUrl || "#download")}
              className="inline-block px-6 py-3 rounded-full text-white font-medium transition-transform hover:scale-105"
              style={{ backgroundColor: themeColor }}
            >
              {data.ctaText}
            </a>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`relative ${heightClass} flex items-center justify-center text-center px-4 sm:px-6 py-16`}
      style={{
        backgroundColor: !hasMedia ? data.backgroundColor || (darkMode ? "#111827" : undefined) : undefined,
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
      {hasMedia && (
        <div className="absolute inset-0 bg-black/50" />
      )}
      <div className="relative z-10 max-w-3xl">
        {data.logo && (
          <img src={sanitizeUrl(data.logo)} alt="Logo" className="h-16 w-16 mx-auto mb-6 rounded-2xl object-cover" />
        )}
        <h1
          className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 break-words"
          style={{ color: isDark ? "#fff" : themeColor }}
        >
          {data.headline || "Welcome"}
        </h1>
        {data.subheadline && (
          <p className={`text-lg sm:text-xl md:text-2xl mb-8 ${isDark ? "text-gray-200" : "text-gray-600"}`}>
            {data.subheadline}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-4">
          {data.ctaText && (
            <a
              href={sanitizeUrl(data.ctaUrl || "#download")}
              className="inline-block px-8 py-4 rounded-full text-white font-semibold text-lg transition-transform hover:scale-105"
              style={{ backgroundColor: themeColor }}
            >
              {data.ctaText}
            </a>
          )}
          {data.ctaSecondaryText && (
            <a
              href={sanitizeUrl(data.ctaSecondaryUrl || "#")}
              className="inline-block px-8 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-105 border-2"
              style={{ borderColor: themeColorSecondary || themeColor, color: isDark ? "#fff" : themeColor }}
            >
              {data.ctaSecondaryText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

interface Props {
  data: {
    headline?: string;
    subheadline?: string;
    ctaText?: string;
    ctaUrl?: string;
    backgroundImage?: string;
  };
  themeColor: string;
}

export function HeroSection({ data, themeColor }: Props) {
  return (
    <section
      className="relative min-h-[70vh] flex items-center justify-center text-center px-6"
      style={{
        backgroundImage: data.backgroundImage ? `url(${data.backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {data.backgroundImage && (
        <div className="absolute inset-0 bg-black/50" />
      )}
      <div className="relative z-10 max-w-3xl">
        <h1
          className="text-5xl md:text-7xl font-bold mb-6"
          style={{ color: data.backgroundImage ? "#fff" : themeColor }}
        >
          {data.headline || "Welcome"}
        </h1>
        {data.subheadline && (
          <p className={`text-xl md:text-2xl mb-8 ${data.backgroundImage ? "text-gray-200" : "text-gray-600"}`}>
            {data.subheadline}
          </p>
        )}
        {data.ctaText && (
          <a
            href={data.ctaUrl || "#download"}
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

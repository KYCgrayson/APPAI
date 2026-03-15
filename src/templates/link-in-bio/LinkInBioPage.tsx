interface Props {
  title: string;
  tagline?: string;
  heroImage?: string;
  content: any;
  themeColor: string;
}

export function LinkInBioPage({ title, tagline, heroImage, content, themeColor }: Props) {
  const links = content?.links || [];

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-6" style={{ backgroundColor: `${themeColor}10` }}>
      <div className="max-w-md w-full text-center">
        {/* Avatar */}
        {heroImage ? (
          <img
            src={heroImage}
            alt={title}
            className="w-24 h-24 rounded-full mx-auto mb-4 object-cover shadow-lg"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold shadow-lg"
            style={{ backgroundColor: themeColor }}
          >
            {title[0] || "?"}
          </div>
        )}

        <h1 className="text-2xl font-bold mb-1">{title}</h1>
        {tagline && <p className="text-gray-600 mb-8">{tagline}</p>}

        {/* Links */}
        <div className="space-y-3">
          {links.map((link: any, i: number) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 px-6 rounded-xl font-medium text-center transition-all hover:scale-[1.02] hover:shadow-md"
              style={{
                backgroundColor: link.style === "filled" ? themeColor : "white",
                color: link.style === "filled" ? "white" : themeColor,
                border: `2px solid ${themeColor}`,
              }}
            >
              {link.icon && <span className="mr-2">{link.icon}</span>}
              {link.title}
            </a>
          ))}
        </div>

        <footer className="mt-12 text-sm text-gray-400">
          Hosted on AIGA
        </footer>
      </div>
    </div>
  );
}

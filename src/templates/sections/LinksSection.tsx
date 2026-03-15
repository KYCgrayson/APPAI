interface Props {
  data: {
    items: Array<{
      title: string;
      url: string;
      icon?: string;
      style?: "filled" | "outlined";
    }>;
  };
  themeColor: string;
}

export function LinksSection({ data, themeColor }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-20 px-6">
      <div className="max-w-md mx-auto space-y-4">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center px-6 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-105"
            style={
              item.style === "outlined"
                ? { border: `2px solid ${themeColor}`, color: themeColor }
                : { backgroundColor: themeColor, color: "#fff" }
            }
          >
            {item.icon && <span className="mr-2">{item.icon}</span>}
            {item.title}
          </a>
        ))}
      </div>
    </section>
  );
}

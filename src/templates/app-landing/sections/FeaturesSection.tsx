import { SmartIcon } from "@/templates/shared/SmartIcon";

interface Props {
  data: {
    items?: Array<{
      icon?: string;
      title: string;
      description: string;
    }>;
  };
  themeColor: string;
}

const LEGACY_ALIASES: Record<string, string> = {
  brain: "sparkles-outline",
  zap: "flash-outline",
  shield: "shield-checkmark-outline",
  star: "star",
  heart: "heart",
  globe: "globe-outline",
  lock: "lock-closed",
  rocket: "rocket-outline",
  code: "code-slash-outline",
  chart: "sparkles-outline",
};

export function FeaturesSection({ data, themeColor }: Props) {
  const items = data.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16" style={{ color: themeColor }}>
          Features
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {items.map((item, i) => {
            const iconValue = item.icon
              ? (LEGACY_ALIASES[item.icon] ?? item.icon)
              : "sparkles-outline";
            return (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-4" style={{ color: themeColor }}>
                  <SmartIcon value={iconValue} size={48} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

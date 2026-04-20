export const dynamic = "force-dynamic";

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { PlatformHeader } from "@/components/PlatformHeader";

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const t = await getTranslations("apps");
  const { category } = await searchParams;
  const activeCategory = category || "ALL";

  const apps = await db.app.findMany({
    where: {
      isApproved: true,
      ...(activeCategory !== "ALL" ? { category: activeCategory } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const categories = [
    "ALL", "WRITING", "CODING", "DESIGN", "AUTOMATION",
    "PRODUCTIVITY", "SOCIAL", "FINANCE", "HEALTH", "EDUCATION",
    "FOOD", "TRAVEL", "ENTERTAINMENT", "GAMES", "MEDIA",
    "UTILITIES", "COMMERCE", "OTHER",
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PlatformHeader />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-8 text-white">{t("title")}</h1>

        <div className="flex gap-2 flex-wrap mb-8">
          {categories.map((cat) => (
            <Link
              key={cat}
              href={cat === "ALL" ? "/apps" : `/apps?category=${cat}`}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                activeCategory === cat
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>

        {apps.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold mb-2 text-white">{t("noAppsTitle")}</h2>
            <p className="text-gray-400">
              {activeCategory !== "ALL"
                ? t("noAppsCategory", { category: activeCategory })
                : t("noAppsDefault")}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {apps.map((app) => (
              <a
                key={app.id}
                href={app.hostedPageSlug ? `/p/${app.hostedPageSlug}` : `/apps/${app.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors block"
              >
                <div className="flex items-start gap-4">
                  {app.logoUrl ? (
                    <img
                      src={app.logoUrl}
                      alt={app.name}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-lg font-bold text-gray-400">
                      {app.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate text-white">{app.name}</h3>
                    <p className="text-sm text-gray-400 line-clamp-2">{app.tagline}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs text-gray-600">{app.category}</span>
                      {app.iosUrl && <span className="text-xs text-blue-400">iOS</span>}
                      {app.androidUrl && <span className="text-xs text-green-400">Android</span>}
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

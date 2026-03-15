export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";

export default async function AppsPage() {
  const apps = await db.app.findMany({
    where: { isApproved: true },
    orderBy: { createdAt: "desc" },
  });

  const categories = [
    "ALL", "WRITING", "CODING", "DESIGN", "AUTOMATION",
    "PRODUCTIVITY", "SOCIAL", "FINANCE", "HEALTH", "EDUCATION", "OTHER",
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            AIGA
          </Link>
          <Link
            href="/dashboard"
            className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-8">Browse Apps</h1>

        <div className="flex gap-2 flex-wrap mb-8">
          {categories.map((cat) => (
            <span
              key={cat}
              className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
            >
              {cat}
            </span>
          ))}
        </div>

        {apps.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold mb-2">No apps yet</h2>
            <p className="text-gray-600">Be the first to submit your app!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {apps.map((app) => (
              <Link
                key={app.id}
                href={app.hostedPageSlug ? `/p/${app.hostedPageSlug}` : `/apps/${app.id}`}
                className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow block"
              >
                <div className="flex items-start gap-4">
                  {app.logoUrl ? (
                    <img
                      src={app.logoUrl}
                      alt={app.name}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-500">
                      {app.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{app.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{app.tagline}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs text-gray-400">{app.category}</span>
                      {app.iosUrl && <span className="text-xs text-blue-400">iOS</span>}
                      {app.androidUrl && <span className="text-xs text-green-400">Android</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

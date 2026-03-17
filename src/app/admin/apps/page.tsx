export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { AdminAppActions } from "./actions";

export default async function AdminAppsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;

  const where = filter === "featured"
    ? { isFeatured: true }
    : filter === "pending"
    ? { isApproved: false }
    : filter === "approved"
    ? { isApproved: true }
    : {};

  const apps = await db.app.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { organization: { select: { name: true, email: true } } },
  });

  const filters = [
    { label: "All", value: "" },
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Featured", value: "featured" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Apps</h1>
        <span className="text-sm text-gray-500">{apps.length} apps</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
          <a
            key={f.value}
            href={f.value ? `/admin/apps?filter=${f.value}` : "/admin/apps"}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              (filter || "") === f.value
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {apps.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-gray-500">No apps found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {app.logoUrl ? (
                    <img src={app.logoUrl} alt={app.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                      {app.name[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{app.name}</span>
                      <span className="text-xs text-gray-400">{app.category}</span>
                      {app.isApproved && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Approved</span>
                      )}
                      {!app.isApproved && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Pending</span>
                      )}
                      {app.isFeatured && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Featured</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{app.tagline}</p>
                    <div className="text-xs text-gray-400 mt-1">
                      by {app.organization.name}
                      {app.hostedPageSlug && <> · <a href={`/p/${app.hostedPageSlug}`} target="_blank" className="text-blue-500 hover:underline">/p/{app.hostedPageSlug}</a></>}
                      {" · "}{new Date(app.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <AdminAppActions
                  appId={app.id}
                  isApproved={app.isApproved}
                  isFeatured={app.isFeatured}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

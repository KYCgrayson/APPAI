export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import Link from "next/link";

export default async function AdminOverviewPage() {
  const [
    totalUsers,
    totalOrgs,
    totalApps,
    totalPages,
    publishedPages,
    totalApiKeys,
    recentApps,
    recentPages,
  ] = await Promise.all([
    db.user.count(),
    db.organization.count(),
    db.app.count(),
    db.hostedPage.count(),
    db.hostedPage.count({ where: { isPublished: true } }),
    db.apiKey.count({ where: { isActive: true } }),
    db.app.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { organization: { select: { name: true } } },
    }),
    db.hostedPage.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { organization: { select: { name: true } } },
    }),
  ]);

  const approvedApps = await db.app.count({ where: { isApproved: true } });
  const featuredApps = await db.app.count({ where: { isFeatured: true } });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Admin Overview</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Users" value={totalUsers} />
        <StatCard label="Organizations" value={totalOrgs} />
        <StatCard label="Apps" value={totalApps} detail={`${approvedApps} approved, ${featuredApps} featured`} />
        <StatCard label="Pages" value={totalPages} detail={`${publishedPages} published`} />
        <StatCard label="Active API Keys" value={totalApiKeys} />
      </div>

      {/* Two-column recent activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Apps */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recently Added Apps</h2>
            <Link href="/admin/apps" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {recentApps.length === 0 ? (
            <p className="text-gray-500 text-sm">No apps yet.</p>
          ) : (
            <div className="space-y-3">
              {recentApps.map((app) => (
                <div key={app.id} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{app.name}</div>
                    <div className="text-xs text-gray-500">
                      {app.organization.name} · {app.category} · {new Date(app.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-3 shrink-0">
                    {app.isApproved ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Approved</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Pending</span>
                    )}
                    {app.isFeatured && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Featured</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Pages */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recently Added Pages</h2>
            <Link href="/admin/pages" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {recentPages.length === 0 ? (
            <p className="text-gray-500 text-sm">No pages yet.</p>
          ) : (
            <div className="space-y-3">
              {recentPages.map((page) => (
                <div key={page.id} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{page.title}</div>
                    <div className="text-xs text-gray-500">
                      {page.organization.name} · /p/{page.slug} · {new Date(page.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-3 ${
                    page.isPublished
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {page.isPublished ? "Published" : "Draft"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-gray-500 text-sm">{label}</div>
      {detail && <div className="text-xs text-gray-400 mt-1">{detail}</div>}
    </div>
  );
}

export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { getPrivateAssetLimits } from "@/lib/private-assets/limits";
import { countNativeAppUsageSince } from "@/lib/native-apps/monitoring";

function level(percent: number) {
  if (percent >= 95) return { label: "Large uploads paused", className: "bg-red-100 text-red-700" };
  if (percent >= 80) return { label: "Review / upgrade planning", className: "bg-orange-100 text-orange-700" };
  if (percent >= 60) return { label: "Warning", className: "bg-yellow-100 text-yellow-700" };
  return { label: "Normal", className: "bg-green-100 text-green-700" };
}

export default async function NativeAppsAdminPage() {
  const limits = getPrivateAssetLimits();
  const [instances, assetGroups, organizations, usage24h] = await Promise.all([
    db.organizationApp.groupBy({ by: ["appType", "status"], _count: { _all: true } }),
    db.privateAsset.groupBy({
      by: ["organizationId", "appType"],
      where: { status: { in: ["ACTIVE", "DELETE_PENDING"] } },
      _sum: { sizeBytes: true },
      _count: { _all: true },
    }),
    db.organization.findMany({ select: { id: true, name: true } }),
    countNativeAppUsageSince("simpleshop", 24 * 60 * 60 * 1000),
  ]);
  const orgById = new Map(organizations.map((org) => [org.id, org.name]));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Native Apps</h1>
        <p className="mt-2 text-sm text-gray-500">Organization instances, private storage and threshold enforcement.</p>
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {instances.map((row) => (
          <div key={`${row.appType}-${row.status}`} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">{row.appType} · {row.status}</div>
            <div className="mt-2 text-3xl font-bold">{row._count._all}</div>
          </div>
        ))}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">Simpleshop events · 24h</div>
          <div className="mt-2 text-3xl font-bold">{usage24h}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr><th className="px-4 py-3">Organization</th><th className="px-4 py-3">App</th><th className="px-4 py-3 text-right">Files</th><th className="px-4 py-3 text-right">Storage</th><th className="px-4 py-3">Threshold</th></tr>
          </thead>
          <tbody>
            {assetGroups.map((row) => {
              const bytes = row._sum.sizeBytes ?? 0;
              const percent = (bytes / limits.organizationLimitBytes) * 100;
              const badge = level(percent);
              return (
                <tr key={`${row.organizationId}-${row.appType}`} className="border-t">
                  <td className="px-4 py-3 font-medium">{orgById.get(row.organizationId) || row.organizationId}</td>
                  <td className="px-4 py-3">{row.appType}</td>
                  <td className="px-4 py-3 text-right">{row._count._all}</td>
                  <td className="px-4 py-3 text-right">{(bytes / 1024 / 1024).toFixed(1)} MB · {percent.toFixed(1)}%</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${badge.className}`}>{badge.label}</span></td>
                </tr>
              );
            })}
            {assetGroups.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No private assets yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Neon storage/compute and Blob transfer totals remain provider-console checks until billing APIs and credentials are explicitly configured. AppAI does not enable unlimited automatic spending.
      </div>
    </div>
  );
}

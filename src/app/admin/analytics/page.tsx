export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  StatCard,
  StackedBar,
  SparkBars,
  HorizontalBarRow,
} from "@/components/admin/StatCard";

interface DailyCount {
  day: Date;
  count: bigint | number;
}

function fillMissingDays(
  rows: DailyCount[],
  days: number,
): Array<{ label: string; value: number }> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    map.set(key, Number(row.count));
  }

  const result: Array<{ label: string; value: number }> = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const mmdd = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    result.push({ label: mmdd, value: map.get(key) ?? 0 });
  }
  return result;
}

export default async function AnalyticsPage() {
  const now = new Date();
  const d1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    pagesByPublished,
    appsByApproved,
    appsFeatured,
    apiKeysByActive,
    apiKeysExpired,
    usersByRole,
    signupDaily,
    activeSessions,
    activeUserIds,
    signups24h,
    signups7d,
    signups30d,
    apiUsed24h,
    apiUsed7d,
    apiUsed30d,
    apiTotalActive,
    publishedPages,
    topOrgs,
  ] = await Promise.all([
    db.hostedPage.groupBy({ by: ["isPublished"], _count: true }),
    db.app.groupBy({ by: ["isApproved"], _count: true }),
    db.app.count({ where: { isFeatured: true } }),
    db.apiKey.groupBy({ by: ["isActive"], _count: true }),
    db.apiKey.count({
      where: { expiresAt: { lt: now, not: null } },
    }),
    db.user.groupBy({ by: ["role"], _count: true }),
    db.$queryRaw<DailyCount[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "User"
      WHERE "createdAt" >= ${d30}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    db.session.count({ where: { expires: { gt: now } } }),
    db.session.findMany({
      where: { expires: { gt: now } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    db.user.count({ where: { createdAt: { gte: d1 } } }),
    db.user.count({ where: { createdAt: { gte: d7 } } }),
    db.user.count({ where: { createdAt: { gte: d30 } } }),
    db.apiKey.count({
      where: { isActive: true, lastUsedAt: { gte: d1 } },
    }),
    db.apiKey.count({
      where: { isActive: true, lastUsedAt: { gte: d7, lt: d1 } },
    }),
    db.apiKey.count({
      where: { isActive: true, lastUsedAt: { gte: d30, lt: d7 } },
    }),
    db.apiKey.count({ where: { isActive: true } }),
    db.hostedPage.count({ where: { isPublished: true } }),
    db.organization.findMany({
      take: 20,
      include: {
        _count: {
          select: {
            users: true,
            pages: true,
            apps: true,
            apiKeys: { where: { isActive: true } },
          },
        },
      },
    }),
  ]);

  // Derive "never / stale" API keys
  const apiUsedNeverOrOld = Math.max(
    0,
    apiTotalActive - apiUsed24h - apiUsed7d - apiUsed30d,
  );
  const apiMax = Math.max(apiUsed24h, apiUsed7d, apiUsed30d, apiUsedNeverOrOld, 1);

  // Status segments
  const publishedCount = pagesByPublished.find((p) => p.isPublished)?._count ?? 0;
  const draftCount = pagesByPublished.find((p) => !p.isPublished)?._count ?? 0;

  const approvedCount = appsByApproved.find((a) => a.isApproved)?._count ?? 0;
  const pendingCount = appsByApproved.find((a) => !a.isApproved)?._count ?? 0;

  const activeKeys = apiKeysByActive.find((k) => k.isActive)?._count ?? 0;
  const revokedKeys = apiKeysByActive.find((k) => !k.isActive)?._count ?? 0;

  const adminCount = usersByRole.find((u) => u.role === "ADMIN")?._count ?? 0;
  const userCount = usersByRole.find((u) => u.role === "USER")?._count ?? 0;

  // Sort top orgs by activity (pages + apps)
  const topOrgsSorted = [...topOrgs]
    .sort(
      (a, b) =>
        (b._count.pages + b._count.apps) - (a._count.pages + a._count.apps),
    )
    .slice(0, 10);

  // Daily signup chart (30 days)
  const signupSeries = fillMissingDays(signupDaily, 30);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <span className="text-xs text-gray-400">
          Snapshot as of {now.toLocaleString()}
        </span>
      </div>

      {/* Row 1: headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Sessions"
          value={activeSessions}
          detail={`${activeUserIds.length} unique user${activeUserIds.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="New Signups (7d)"
          value={signups7d}
          detail={`${signups24h} in last 24h`}
        />
        <StatCard
          label="API Keys Used (24h)"
          value={apiUsed24h}
          detail={`of ${apiTotalActive} active`}
        />
        <StatCard
          label="Published Pages"
          value={publishedPages}
          detail={`${draftCount} draft`}
        />
      </div>

      {/* Row 2: status breakdowns */}
      <h2 className="text-lg font-semibold mb-4">Status Breakdowns</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <StackedBar
          title="Pages"
          segments={[
            { label: "Published", count: publishedCount, color: "#10b981" },
            { label: "Draft", count: draftCount, color: "#fbbf24" },
          ]}
        />
        <StackedBar
          title="Apps"
          segments={[
            { label: "Approved", count: approvedCount, color: "#10b981" },
            { label: "Pending", count: pendingCount, color: "#fbbf24" },
          ]}
          total={approvedCount + pendingCount}
        />
        <StackedBar
          title="API Keys"
          segments={[
            { label: "Active", count: activeKeys, color: "#10b981" },
            { label: "Revoked", count: revokedKeys, color: "#ef4444" },
            { label: "Expired", count: apiKeysExpired, color: "#9ca3af" },
          ]}
          total={activeKeys + revokedKeys}
        />
        <StackedBar
          title="Users"
          segments={[
            { label: "User", count: userCount, color: "#6366f1" },
            { label: "Admin", count: adminCount, color: "#8b5cf6" },
          ]}
        />
      </div>

      {/* Row 3: signups over time */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-semibold">New Signups (30 days)</h2>
          <span className="text-sm text-gray-500">
            {signups30d} total over 30 days
          </span>
        </div>
        <SparkBars data={signupSeries} color="#6366f1" />
      </div>

      {/* Row 4: API key last-used */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-semibold">API Key Activity</h2>
          <span className="text-sm text-gray-500">
            {apiTotalActive} active keys
          </span>
        </div>
        <div className="space-y-3">
          <HorizontalBarRow
            label="Used in last 24 hours"
            value={apiUsed24h}
            max={apiMax}
            color="#10b981"
          />
          <HorizontalBarRow
            label="Used in last 7 days (not 24h)"
            value={apiUsed7d}
            max={apiMax}
            color="#3b82f6"
          />
          <HorizontalBarRow
            label="Used in last 30 days (not 7d)"
            value={apiUsed30d}
            max={apiMax}
            color="#fbbf24"
          />
          <HorizontalBarRow
            label="Never used or stale (>30d)"
            value={apiUsedNeverOrOld}
            max={apiMax}
            color="#9ca3af"
          />
        </div>
      </div>

      {/* Row 5: top orgs */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Top Organizations</h2>
        {topOrgsSorted.length === 0 ? (
          <p className="text-gray-500 text-sm">No organizations yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3">Plan</th>
                <th className="pb-2 pr-3 text-right">Users</th>
                <th className="pb-2 pr-3 text-right">Pages</th>
                <th className="pb-2 pr-3 text-right">Apps</th>
                <th className="pb-2 text-right">Active Keys</th>
              </tr>
            </thead>
            <tbody>
              {topOrgsSorted.map((org) => (
                <tr key={org.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium truncate max-w-[220px]">
                    {org.name}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {org.plan}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {org._count.users}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {org._count.pages}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {org._count.apps}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {org._count.apiKeys}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

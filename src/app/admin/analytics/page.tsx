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
    views24h,
    views7d,
    views30d,
    uniqueVisitors24h,
    uniqueVisitors7d,
    viewsDaily,
    topPages7d,
    topCountries7d,
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
    db.pageView.count({ where: { createdAt: { gte: d1 } } }),
    db.pageView.count({ where: { createdAt: { gte: d7 } } }),
    db.pageView.count({ where: { createdAt: { gte: d30 } } }),
    db.pageView
      .findMany({
        where: { createdAt: { gte: d1 } },
        distinct: ["ipHash"],
        select: { ipHash: true },
      })
      .then((rows) => rows.length),
    db.pageView
      .findMany({
        where: { createdAt: { gte: d7 } },
        distinct: ["ipHash"],
        select: { ipHash: true },
      })
      .then((rows) => rows.length),
    db.$queryRaw<DailyCount[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "PageView"
      WHERE "createdAt" >= ${d30}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    db.pageView.groupBy({
      by: ["pageId", "slug", "locale"],
      where: { createdAt: { gte: d7 } },
      _count: { _all: true },
      orderBy: { _count: { pageId: "desc" } },
      take: 10,
    }),
    db.pageView.groupBy({
      by: ["country"],
      where: { createdAt: { gte: d7 }, country: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 10,
    }),
  ]);

  // Enrich top pages with org + title info
  const topPageIds = topPages7d.map((p) => p.pageId);
  const topPageDetails = topPageIds.length
    ? await db.hostedPage.findMany({
        where: { id: { in: topPageIds } },
        select: {
          id: true,
          title: true,
          slug: true,
          locale: true,
          organization: { select: { name: true } },
        },
      })
    : [];
  const topPageMap = new Map(topPageDetails.map((p) => [p.id, p]));

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

  // Daily page view chart (30 days)
  const viewSeries = fillMissingDays(viewsDaily, 30);

  // Traffic burden status
  let trafficStatus: { label: string; color: string; detail: string };
  if (views24h === 0) {
    trafficStatus = {
      label: "No traffic",
      color: "#9ca3af",
      detail: "No page views recorded in the last 24 hours",
    };
  } else if (views24h >= 10000) {
    trafficStatus = {
      label: "High traffic",
      color: "#ef4444",
      detail: `${views24h.toLocaleString()} views in 24h — check burden`,
    };
  } else if (views24h >= 1000) {
    trafficStatus = {
      label: "Active",
      color: "#f59e0b",
      detail: `${views24h.toLocaleString()} views in 24h`,
    };
  } else {
    trafficStatus = {
      label: "Active",
      color: "#10b981",
      detail: `${views24h.toLocaleString()} views in 24h`,
    };
  }

  const topCountryMax = Math.max(
    ...topCountries7d.map((c) => c._count._all),
    1,
  );

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

      {/* Row 1.5: Hosted Page Traffic */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Hosted Page Traffic</h2>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: trafficStatus.color }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: trafficStatus.color }}
            >
              {trafficStatus.label}
            </span>
            <span className="text-xs text-gray-500">
              — {trafficStatus.detail}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard
            label="Views (24h)"
            value={views24h.toLocaleString()}
            detail={`${uniqueVisitors24h} unique`}
          />
          <StatCard
            label="Views (7d)"
            value={views7d.toLocaleString()}
            detail={`${uniqueVisitors7d} unique`}
          />
          <StatCard
            label="Views (30d)"
            value={views30d.toLocaleString()}
          />
          <StatCard
            label="Published Pages"
            value={publishedPages}
            detail={
              views7d > 0
                ? `${(views7d / Math.max(publishedPages, 1)).toFixed(1)} views/page`
                : "No views yet"
            }
          />
          <StatCard
            label="Top Country (7d)"
            value={topCountries7d[0]?.country ?? "—"}
            detail={
              topCountries7d[0]
                ? `${topCountries7d[0]._count._all.toLocaleString()} views`
                : "No data yet"
            }
          />
        </div>

        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">
              Daily views (30 days)
            </h3>
            <span className="text-xs text-gray-400">
              {views30d.toLocaleString()} total
            </span>
          </div>
          <SparkBars data={viewSeries} color="#10b981" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Top pages (7d)
            </h3>
            {topPages7d.length === 0 ? (
              <p className="text-sm text-gray-400">No page views yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 pr-3">Page</th>
                    <th className="pb-2 pr-3">Locale</th>
                    <th className="pb-2 pr-3">Org</th>
                    <th className="pb-2 text-right">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages7d.map((row) => {
                    const detail = topPageMap.get(row.pageId);
                    return (
                      <tr
                        key={row.pageId}
                        className="border-b last:border-0"
                      >
                        <td className="py-2 pr-3 truncate max-w-[180px]">
                          <a
                            href={`/p/${row.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium hover:underline"
                          >
                            {detail?.title || row.slug}
                          </a>
                          <div className="text-xs text-gray-400 truncate">
                            /p/{row.slug}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-xs text-gray-500">
                          {row.locale}
                        </td>
                        <td className="py-2 pr-3 text-xs text-gray-500 truncate max-w-[120px]">
                          {detail?.organization?.name ?? "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium">
                          {row._count._all.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Top countries (7d)
            </h3>
            {topCountries7d.length === 0 ? (
              <p className="text-sm text-gray-400">No geo data yet.</p>
            ) : (
              <div className="space-y-2">
                {topCountries7d.map((c) => (
                  <HorizontalBarRow
                    key={c.country ?? "unknown"}
                    label={c.country ?? "Unknown"}
                    value={c._count._all}
                    max={topCountryMax}
                    color="#6366f1"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
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

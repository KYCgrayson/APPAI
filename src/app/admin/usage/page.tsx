export const dynamic = "force-dynamic";

import { db } from "@/lib/db";

// Generic usage dashboard for all interactive-tool connectors.
// Replaces the subtitle-specific one. See
// docs/interactive-tools-architecture.md.
const EST_COST_USD: Record<string, number> = {
  // rough per-action estimates for at-a-glance monitoring only
  "job.transcribe": 0.02,
  "job.render": 0,
};

export default async function UsagePage() {
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const since24h = new Date(Date.now() - 24 * 3600 * 1000);

  const [rows, users, total7d, total24h] = await Promise.all([
    db.usageEvent.groupBy({
      by: ["connector", "userId", "action"],
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.user.findMany({ select: { id: true, email: true, name: true, role: true } }),
    db.usageEvent.count({ where: { createdAt: { gte: since7d } } }),
    db.usageEvent.count({ where: { createdAt: { gte: since24h } } }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const estSpend = rows
    .reduce((n, r) => {
      const u = r.userId ? userById.get(r.userId) : null;
      if (u?.role === "ADMIN") return n; // admin runs on subscription, no API cost
      return n + (EST_COST_USD[r.action] ?? 0) * r._count._all;
    }, 0)
    .toFixed(2);

  type Row = {
    connector: string;
    user: string;
    role: string;
    action: string;
    count: number;
    last: Date | null;
  };
  const table: Row[] = rows
    .map((r) => {
      const u = r.userId ? userById.get(r.userId) : null;
      return {
        connector: r.connector,
        user: u?.email ?? u?.name ?? r.userId ?? "anonymous",
        role: u?.role ?? "USER",
        action: r.action,
        count: r._count._all,
        last: r._max.createdAt,
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tool Usage</h1>
        <span className="text-sm text-gray-500">
          {new Set(table.map((r) => r.connector)).size} connectors
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          ["Events (24h)", String(total24h)],
          ["Events (7d)", String(total7d)],
          ["Rows", String(table.length)],
          ["Est. API spend*", `$${estSpend}`],
        ].map(([label, val]) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-2xl font-bold">{val}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Connector</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium text-right">Count</th>
              <th className="px-4 py-3 font-medium">Last</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-3 font-medium">{r.connector}</td>
                <td className="px-4 py-3 truncate max-w-xs">{r.user}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      r.role === "ADMIN"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {r.role === "ADMIN" ? "admin (∞)" : "user"}
                  </span>
                </td>
                <td className="px-4 py-3">{r.action}</td>
                <td className="px-4 py-3 text-right font-medium">{r.count}</td>
                <td className="px-4 py-3 text-gray-500">
                  {r.last ? r.last.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {table.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No usage yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-4">
        * Rough estimate; authoritative spend + the hard cap live in each
        provider console. Admin actions run on the owner subscription at no
        API cost.
      </p>
    </div>
  );
}

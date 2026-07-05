export const dynamic = "force-dynamic";

import { db } from "@/lib/db";

// Video-subtitle usage dashboard: who used the service, how many times,
// and estimated API spend. Admin-gated by the parent admin layout.
//
// Cost note: non-admin translation runs on the metered Claude API (Haiku).
// A ~10-min clip is roughly 2–3k tokens ≈ US$0.01–0.02. This is a rough
// estimate for at-a-glance monitoring, not a billing source of truth —
// the authoritative number and hard cap live in the Anthropic console.
const EST_COST_PER_TRANSCRIBE_USD = 0.02;

export default async function SubtitleUsagePage() {
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const since24h = new Date(Date.now() - 24 * 3600 * 1000);

  const [rows, users, total7d, total24h] = await Promise.all([
    db.subtitleUsage.groupBy({
      by: ["userId", "kind"],
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.user.findMany({ select: { id: true, email: true, name: true, role: true } }),
    db.subtitleUsage.count({ where: { createdAt: { gte: since7d } } }),
    db.subtitleUsage.count({
      where: { kind: "transcribe", createdAt: { gte: since24h } },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));

  // Fold per-(user,kind) rows into per-user summaries.
  type Summary = {
    id: string;
    label: string;
    role: string;
    transcribe: number;
    render: number;
    last: Date | null;
  };
  const byUser = new Map<string, Summary>();
  for (const r of rows) {
    const u = userById.get(r.userId);
    const s =
      byUser.get(r.userId) ??
      ({
        id: r.userId,
        label: u?.email ?? u?.name ?? r.userId,
        role: u?.role ?? "USER",
        transcribe: 0,
        render: 0,
        last: null,
      } satisfies Summary);
    if (r.kind === "transcribe") s.transcribe = r._count._all;
    if (r.kind === "render") s.render = r._count._all;
    if (r._max.createdAt && (!s.last || r._max.createdAt > s.last))
      s.last = r._max.createdAt;
    byUser.set(r.userId, s);
  }
  const summaries = [...byUser.values()].sort(
    (a, b) => b.transcribe - a.transcribe,
  );

  const totalTranscribe = summaries.reduce((n, s) => n + s.transcribe, 0);
  const nonAdminTranscribe = summaries
    .filter((s) => s.role !== "ADMIN")
    .reduce((n, s) => n + s.transcribe, 0);
  const estSpend = (nonAdminTranscribe * EST_COST_PER_TRANSCRIBE_USD).toFixed(2);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Subtitle Usage</h1>
        <span className="text-sm text-gray-500">{summaries.length} users</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          ["Videos (24h)", String(total24h)],
          ["Jobs (7d)", String(total7d)],
          ["Total transcribes", String(totalTranscribe)],
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
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium text-right">Videos</th>
              <th className="px-4 py-3 font-medium text-right">Renders</th>
              <th className="px-4 py-3 font-medium">Last used</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3 truncate max-w-xs">{s.label}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      s.role === "ADMIN"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {s.role === "ADMIN" ? "you (∞)" : "USER (1/day)"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {s.transcribe}
                </td>
                <td className="px-4 py-3 text-right">{s.render}</td>
                <td className="px-4 py-3 text-gray-500">
                  {s.last ? s.last.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {summaries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No usage yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        * Rough estimate (Haiku, ~$0.02/video). Authoritative spend and the
        hard monthly cap are set in the Anthropic console. Admin (you) runs on
        the subscription CLI at no API cost.
      </p>
    </div>
  );
}

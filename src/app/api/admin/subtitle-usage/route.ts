import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

/**
 * Admin-only usage stats for the video-subtitle service.
 * GET /api/admin/subtitle-usage → per-user totals + last-7-days activity.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [byUser, recent, total] = await Promise.all([
    db.subtitleUsage.groupBy({
      by: ["userId", "kind"],
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.subtitleUsage.count({ where: { createdAt: { gte: since7d } } }),
    db.subtitleUsage.count(),
  ]);

  // Attach emails for readability.
  const userIds = [...new Set(byUser.map((r) => r.userId))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email ?? u.name ?? u.id]));

  return NextResponse.json({
    total_jobs: total,
    jobs_last_7_days: recent,
    by_user: byUser.map((r) => ({
      user: emailById.get(r.userId) ?? r.userId,
      kind: r.kind,
      count: r._count._all,
      last_used: r._max.createdAt,
    })),
  });
}

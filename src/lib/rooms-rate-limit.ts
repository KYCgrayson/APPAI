import { Prisma } from '@prisma/client';

// Both rooms and leaderboards clean this shared table. Legacy nickname cooldown
// records are unused and expire with the ordinary rate buckets; no migration needed.
export function expiredRateLimits(now: Date, defaultWindowMs: number) {
  return Prisma.sql`"windowStart" <= ${new Date(+now - defaultWindowMs)}`;
}

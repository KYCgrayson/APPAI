import { Prisma } from '@prisma/client';

export const NICKNAME_COOLDOWN_MS = 7 * 86_400_000;

// Both rooms and leaderboards clean this shared table. Keep nickname cooldowns
// for their full window, including after their GamePlayer row has been deleted.
export function expiredRateLimits(now: Date, defaultWindowMs: number) {
  return Prisma.sql`"windowStart" <= ${new Date(+now - defaultWindowMs)}
    AND ("key" NOT LIKE 'lb:nick:%' OR "windowStart" <= ${new Date(+now - NICKNAME_COOLDOWN_MS)})`;
}

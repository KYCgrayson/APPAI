import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roomDeps } from '@/lib/rooms-server';
import type { LeaderboardDeps } from './leaderboard';
import { createLeaderboardStore } from './leaderboard-store';

export const leaderboardDeps: LeaderboardDeps = {
  env: process.env,
  async currentUser() { return (await auth())?.user?.id ?? null; },
  store: createLeaderboardStore(db, (key, windowMs, now) => roomDeps.store.rateHit(key, windowMs, now)),
};

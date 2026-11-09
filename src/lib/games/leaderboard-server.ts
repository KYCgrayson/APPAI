import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roomDeps } from '@/lib/rooms-server';
import { DAY, type LeaderboardDeps, type LeaderboardData, type Entry, type Run } from './leaderboard';

function dataFor(tx: Prisma.TransactionClient): LeaderboardData {
  const visible = (game: string, board: string, tier: string) => Prisma.sql`
    s."game" = ${game} AND s."board" = ${board} AND s."tier" = ${tier}
    AND s."hidden" = false AND p."status" = 'active' AND p."nickname" <> ''`;
  return {
    player: userId => tx.gamePlayer.findUnique({ where: { userId } }),
    nicknameOwner: nicknameKey => tx.gamePlayer.findUnique({ where: { nicknameKey } }),
    async putPlayer(player) { await tx.gamePlayer.upsert({ where: { userId: player.userId }, create: player, update: player }); },
    async run(id) { return await tx.gameRun.findUnique({ where: { id } }) as Run | null; },
    async putRun(run) {
      const row = { ...run, moves: run.moves === null ? Prisma.DbNull : run.moves as Prisma.InputJsonValue };
      await tx.gameRun.upsert({ where: { id: run.id }, create: row, update: row });
    },
    score: (board, userId, tier) => tx.gameScore.findUnique({ where: { board_userId_tier: { board, userId, tier } } }),
    scoreById: id => tx.gameScore.findUnique({ where: { id } }),
    async putScore(score) { await tx.gameScore.upsert({ where: { id: score.id }, create: score, update: score }); },
    async rank(game, board, tier, result) {
      const rows = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT count(*) AS count FROM "GameScore" s JOIN "GamePlayer" p ON p."userId" = s."userId"
        WHERE ${visible(game, board, tier)}
        AND (s."score", s."timeMs", s."achievedAt") < (${result.score}::int, ${result.timeMs}::int, ${result.achievedAt}::timestamp)`);
      return Number(rows[0].count) + 1;
    },
    async view(game, board, tier, limit, userId) {
      const rows = await tx.$queryRaw<(Omit<Entry, 'rank'> & { userId: string; rank: bigint; total: bigint })[]>(Prisma.sql`
        WITH ranked AS (
          SELECT s."id", s."userId", p."nickname", s."tier", s."score", s."timeMs", s."achievedAt",
            row_number() OVER (ORDER BY s."score", s."timeMs", s."achievedAt", s."id") AS rank,
            count(*) OVER () AS total
          FROM "GameScore" s JOIN "GamePlayer" p ON p."userId" = s."userId"
          WHERE ${visible(game, board, tier)}
        ) SELECT * FROM ranked WHERE rank <= ${limit} OR "userId" = ${userId} ORDER BY rank`);
      const entry = (row: typeof rows[number]): Entry => ({ id: row.id, rank: Number(row.rank), nickname: row.nickname, tier: row.tier, score: row.score, timeMs: row.timeMs, achievedAt: row.achievedAt });
      return { entries: rows.filter(r => Number(r.rank) <= limit).map(entry), total: Number(rows[0]?.total ?? 0), ...(userId ? { me: rows.find(r => r.userId === userId) ? entry(rows.find(r => r.userId === userId)!) : null } : {}) };
    },
    profileScores: userId => tx.gameScore.findMany({ where: { userId }, orderBy: { achievedAt: 'desc' } }),
    async deletePlayer(userId) {
      await tx.gameScore.deleteMany({ where: { userId } });
      await tx.gameRun.deleteMany({ where: { userId } });
      await tx.gamePlayer.deleteMany({ where: { userId } });
      // Remove this account's report identifiers as well, without unhiding moderated scores.
      await tx.$executeRaw`UPDATE "GameScore" SET "reporters" = array_remove("reporters", ${userId}) WHERE ${userId} = ANY("reporters")`;
    },
  };
}
export const leaderboardDeps: LeaderboardDeps = {
  env: process.env,
  async currentUser() { return (await auth())?.user?.id ?? null; },
  store: {
    rateHit: (key, windowMs, now) => roomDeps.store.rateHit(key, windowMs, now),
    async transaction(fn) {
      for (let attempt = 0; ; attempt++) {
        try { return await db.$transaction(tx => fn(dataFor(tx)), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
        catch (error) {
          // A concurrent first score/nickname insert can surface as a unique
          // conflict instead of P2034. Re-read the winner before deciding.
          if (attempt < 4 && error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) continue;
          throw error;
        }
      }
    },
    async cleanup(now) {
      // No cron: every admitted creation processes at most 200 rows per operation.
      // Expired runs keep tombstones for seven days after expiry for useful 410 responses.
      // Finished replays are cleared at seven days; scores have no expiry.
      const weekAgo = new Date(+now - 7 * DAY), dayAgo = new Date(+now - DAY);
      await db.$executeRaw`UPDATE "GameRun" SET "status" = 'expired' WHERE "id" IN
        (SELECT "id" FROM "GameRun" WHERE "expiresAt" <= ${now} AND "status" <> 'expired' LIMIT 200)`;
      await db.$executeRaw`UPDATE "GameRun" SET "moves" = NULL WHERE "id" IN
        (SELECT "id" FROM "GameRun" WHERE "finishedAt" <= ${weekAgo} AND "moves" IS NOT NULL LIMIT 200)`;
      await db.$executeRaw`DELETE FROM "GameRun" WHERE "id" IN
        (SELECT "id" FROM "GameRun" WHERE "expiresAt" <= ${weekAgo} AND "moves" IS NULL LIMIT 200)`;
      await db.$executeRaw`DELETE FROM "GameRoomRateLimit" WHERE "key" IN
        (SELECT "key" FROM "GameRoomRateLimit" WHERE "key" LIKE 'lb:%' AND "windowStart" <= ${dayAgo} LIMIT 1000)`;
    },
  },
};

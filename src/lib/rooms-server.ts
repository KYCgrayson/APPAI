import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { RATE_LIMITS, type RoomDeps, type RoomMove, type RoomRecord, type RoomStatus } from "@/lib/rooms";

type Row = Prisma.GameRoomGetPayload<object>;
function toRecord(row: Row): RoomRecord {
  return {
    code: row.code, game: row.game, state: row.state, version: row.version, turn: row.turn,
    seatTokens: row.seatTokens, seatSeenAt: row.seatSeenAt, moves: row.moves as unknown as RoomMove[],
    status: row.status as RoomStatus, moveCount: row.moveCount, createdAt: row.createdAt, expiresAt: row.expiresAt,
  };
}
const json = (value: unknown) => value as Prisma.InputJsonValue;
const longestWindowMs = Math.max(...Object.values(RATE_LIMITS).map(rule => rule.windowMs));

export const roomDeps: RoomDeps = {
  env: process.env,
  store: {
    async rateHit(key, windowMs, now) {
      const cutoff = new Date(now.getTime() - windowMs);
      // One statement so concurrent serverless instances cannot both pass the limit.
      const rows = await db.$queryRaw<{ count: number }[]>`
        INSERT INTO "GameRoomRateLimit" ("key", "windowStart", "count") VALUES (${key}, ${now}, 1)
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "GameRoomRateLimit"."windowStart" <= ${cutoff} THEN 1 ELSE "GameRoomRateLimit"."count" + 1 END,
          "windowStart" = CASE WHEN "GameRoomRateLimit"."windowStart" <= ${cutoff} THEN ${now} ELSE "GameRoomRateLimit"."windowStart" END
        RETURNING "count"`;
      return Number(rows[0]?.count ?? 0);
    },
    activeRoomCount: now => db.gameRoom.count({ where: { expiresAt: { gt: now } } }),
    async createRoom(room) {
      try {
        await db.gameRoom.create({ data: { ...room, state: json(room.state), moves: json(room.moves) } });
        return true;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
        throw error;
      }
    },
    async findRoom(code, now) {
      const row = await db.gameRoom.findFirst({ where: { code, expiresAt: { gt: now } } });
      return row ? toRecord(row) : null;
    },
    async updateRoom(code, expectedVersion, update, now) {
      const result = await db.gameRoom.updateMany({
        where: { code, version: expectedVersion, expiresAt: { gt: now } },
        data: { ...update, state: json(update.state), moves: json(update.moves) },
      });
      return result.count === 1;
    },
    async touchSeat(code, seat, now) {
      // Postgres arrays are 1-based. Presence does not bump the version.
      await db.$executeRaw`UPDATE "GameRoom" SET "seatSeenAt"[${seat + 1}::int] = ${now} WHERE "code" = ${code}`;
    },
    async cleanup(now) {
      const staleRates = new Date(now.getTime() - longestWindowMs);
      await db.$executeRaw`DELETE FROM "GameRoom" WHERE "code" IN (SELECT "code" FROM "GameRoom" WHERE "expiresAt" <= ${now} LIMIT 200)`;
      await db.$executeRaw`DELETE FROM "GameRoomRateLimit" WHERE "key" IN (SELECT "key" FROM "GameRoomRateLimit" WHERE "windowStart" <= ${staleRates} LIMIT 1000)`;
    },
  },
};

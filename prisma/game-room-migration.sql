CREATE TABLE "GameRoom" (
  "code" TEXT PRIMARY KEY,
  "game" TEXT NOT NULL,
  "state" JSONB NOT NULL CHECK (octet_length("state"::text) <= 16384),
  "version" INTEGER NOT NULL,
  "turn" INTEGER,
  "seatTokens" TEXT[] NOT NULL,
  "lastMove" JSONB,
  "status" TEXT NOT NULL CHECK ("status" IN ('waiting', 'playing', 'finished')),
  "moveCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GameRoom_expiresAt_idx" ON "GameRoom"("expiresAt");
CREATE TABLE "GameRoomRateLimit" (
  "key" TEXT PRIMARY KEY,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL
);

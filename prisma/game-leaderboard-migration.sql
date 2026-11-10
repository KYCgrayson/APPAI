-- #68 phase 1: only three leaderboard tables. Run separately after approval.
CREATE TABLE "GamePlayer" (
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "nicknameKey" TEXT NOT NULL,
    "nicknameSetAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "GameRun" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "score" INTEGER,
    "timeMs" INTEGER,
    "moves" JSONB,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GameScore" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "runId" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "reporters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "GameScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GamePlayer_nicknameKey_key" ON "GamePlayer"("nicknameKey");
CREATE UNIQUE INDEX "GameRun_tokenHash_key" ON "GameRun"("tokenHash");
CREATE INDEX "GameRun_expiresAt_idx" ON "GameRun"("expiresAt");
CREATE INDEX "GameRun_userId_board_idx" ON "GameRun"("userId", "board");
CREATE INDEX "GameRun_finishedAt_idx" ON "GameRun"("finishedAt");
CREATE INDEX "GameScore_board_tier_hidden_score_timeMs_achievedAt_idx" ON "GameScore"("board", "tier", "hidden", "score", "timeMs", "achievedAt");
CREATE INDEX "GameScore_userId_idx" ON "GameScore"("userId");
CREATE UNIQUE INDEX "GameScore_board_userId_tier_key" ON "GameScore"("board", "userId", "tier");

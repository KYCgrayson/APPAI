-- SubtitleUsage table for the video-subtitle service usage tracking.
-- Apply to the production Neon DB either by running this SQL directly, or
-- (repo convention) `DATABASE_URL=<prod> npx prisma db push`.

CREATE TABLE IF NOT EXISTS "SubtitleUsage" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "kind"      TEXT NOT NULL,
    "jobId"     TEXT,
    "videoHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubtitleUsage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SubtitleUsage_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SubtitleUsage_userId_createdAt_idx"
    ON "SubtitleUsage"("userId", "createdAt");

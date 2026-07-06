-- One-shot finalize for the video-subtitle service on production (Neon).
-- Runs two things:
--   1) Create the SubtitleUsage table (usage tracking + non-admin daily quota)
--   2) Publish "Subtitle Studio" as an approved app in the public gallery
-- Idempotent: safe to run more than once.

-- 1) Usage table -----------------------------------------------------------
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

-- 2) Gallery app card -------------------------------------------------------
-- Attach to the owner/admin's organization; approved so it shows publicly.
INSERT INTO "App" (
    "id", "organizationId", "name", "tagline", "description",
    "category", "url", "isApproved", "isFeatured", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    u."organizationId",
    'Subtitle Studio',
    'Add Chinese/English subtitles to any YouTube clip',
    'Paste a YouTube URL, trim a clip up to 10 minutes, auto-transcribe with Whisper, translate (Chinese ⇄ English and more), style the subtitles, preview on the frame, and download a video with the subtitles burned in. Free — sign in to use, 1 video per day.',
    'MEDIA',
    'https://appai.info/subtitle',
    true,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" = 'ADMIN' AND u."organizationId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "App" a WHERE a."name" = 'Subtitle Studio')
ORDER BY u."createdAt"
LIMIT 1;

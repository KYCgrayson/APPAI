-- M1. Apply with psql -v ON_ERROR_STOP=1 -f; never prisma db push.
-- Run scripts/check-hosted-page-removal-schema.mjs after EVERY application.
BEGIN;
ALTER TABLE "HostedPage"
  ADD COLUMN IF NOT EXISTS "removalState" TEXT,
  ADD COLUMN IF NOT EXISTS "removalSource" TEXT,
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "removedById" TEXT,
  ADD COLUMN IF NOT EXISTS "removalBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "wasPublished" BOOLEAN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HostedPage_removal_consistent'
    AND conrelid = '"HostedPage"'::regclass) THEN
    ALTER TABLE "HostedPage" ADD CONSTRAINT "HostedPage_removal_consistent" CHECK (
      ("removalState" IS NULL AND "removalSource" IS NULL AND "removedAt" IS NULL
        AND "removedById" IS NULL AND "removalBatchId" IS NULL AND "wasPublished" IS NULL)
      OR
      ("removalState" IS NOT NULL AND "removalState" IN ('UNPUBLISHED', 'DELETED')
        AND "removalSource" IS NOT NULL AND "removalSource" IN ('OWNER', 'ADMIN')
        AND "removedAt" IS NOT NULL AND "removedById" IS NOT NULL
        AND "removalBatchId" IS NOT NULL AND "wasPublished" IS NOT NULL AND "isPublished" = false)
    ) NOT VALID;
  END IF;
END $$;
ALTER TABLE "HostedPage" VALIDATE CONSTRAINT "HostedPage_removal_consistent";
CREATE TABLE IF NOT EXISTS "HostedPageEvent" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "batchId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "parentSlug" TEXT,
  "locale" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromState" TEXT,
  "toState" TEXT,
  "actorKind" TEXT NOT NULL,
  "actorUserId" TEXT,
  "apiKeyId" TEXT
);
CREATE INDEX IF NOT EXISTS "HostedPage_organizationId_createdAt_idx" ON "HostedPage" ("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "HostedPageEvent_organizationId_createdAt_idx" ON "HostedPageEvent" ("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "HostedPageEvent_pageId_createdAt_idx" ON "HostedPageEvent" ("pageId", "createdAt");
COMMIT;

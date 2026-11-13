-- DESTRUCTIVE ABANDONMENT ONLY: not a reversible migration.
-- Normal rollback: roll back code, KEEP columns, CHECK and event table.
-- Old code cannot publish removed rows (CHECK rejects it as 500), but can add
-- locales to removed logical pages. Do not use old code as a removal-aware API.
-- This down script is only for abandoning M1 BEFORE any removal/audit records.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "HostedPage" WHERE "removalState" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "HostedPageEvent") THEN
    RAISE EXCEPTION 'Cannot abandon M1 after removal or audit records exist';
  END IF;
END $$;
DROP TABLE "HostedPageEvent";
DROP INDEX IF EXISTS "HostedPage_organizationId_createdAt_idx";
ALTER TABLE "HostedPage" DROP CONSTRAINT "HostedPage_removal_consistent",
  DROP COLUMN "removalState", DROP COLUMN "removalSource", DROP COLUMN "removedAt",
  DROP COLUMN "removedById", DROP COLUMN "removalBatchId", DROP COLUMN "wasPublished";
COMMIT;

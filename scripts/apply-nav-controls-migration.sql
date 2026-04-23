-- Add nav-control fields to HostedPage: hideFromNav + navOrder.
--
-- Both columns are additive with safe defaults (hideFromNav=false, navOrder=NULL),
-- so existing rows behave identically. No table rewrite, no lock beyond a brief
-- ACCESS EXCLUSIVE during catalog update.
--
-- Apply via either:
--   psql "$DATABASE_URL" -f scripts/apply-nav-controls-migration.sql
-- or:
--   npx prisma db push   (will diff schema and apply this same change)

BEGIN;

ALTER TABLE "HostedPage"
  ADD COLUMN IF NOT EXISTS "hideFromNav" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "HostedPage"
  ADD COLUMN IF NOT EXISTS "navOrder" INTEGER;

COMMIT;

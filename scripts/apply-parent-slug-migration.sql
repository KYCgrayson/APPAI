-- Sprint 1 Team A task #1: add parentSlug to HostedPage for multi-page sites.
--
-- This is an additive, nullable column + a new index. Both are online-safe on
-- Postgres (no table rewrite, no lock beyond a brief ACCESS EXCLUSIVE during
-- catalog update). Existing rows get parentSlug=NULL meaning "root page",
-- which preserves current behaviour.
--
-- Apply via either:
--   psql "$DATABASE_URL" -f scripts/apply-parent-slug-migration.sql
-- or:
--   npx prisma db push   (will diff schema and apply this same change)

BEGIN;

ALTER TABLE "HostedPage"
  ADD COLUMN IF NOT EXISTS "parentSlug" TEXT;

CREATE INDEX IF NOT EXISTS "HostedPage_organizationId_parentSlug_slug_idx"
  ON "HostedPage" ("organizationId", "parentSlug", "slug");

COMMIT;

-- AppAI native apps Phase 1
-- Apply with a direct, non-pooled PostgreSQL connection before deploying code.
-- This migration is idempotent so it can be reviewed and rehearsed safely.

ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "appType" TEXT;
ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "runtimePath" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "App_appType_key" ON "App"("appType");

CREATE TABLE IF NOT EXISTS "OrganizationApp" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "appType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationApp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationApp_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationApp_status_check"
    CHECK ("status" IN ('ACTIVE', 'SUSPENDED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationApp_organizationId_appType_key"
  ON "OrganizationApp"("organizationId", "appType");
CREATE INDEX IF NOT EXISTS "OrganizationApp_appType_status_idx"
  ON "OrganizationApp"("appType", "status");
CREATE INDEX IF NOT EXISTS "OrganizationApp_organizationId_status_idx"
  ON "OrganizationApp"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "PrivateAsset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "appType" TEXT NOT NULL,
  "pathname" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT NOT NULL,
  "deletedByUserId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivateAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivateAsset_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PrivateAsset_status_check"
    CHECK ("status" IN ('ACTIVE', 'DELETE_PENDING', 'DELETED')),
  CONSTRAINT "PrivateAsset_sizeBytes_check" CHECK ("sizeBytes" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "PrivateAsset_pathname_key"
  ON "PrivateAsset"("pathname");
CREATE INDEX IF NOT EXISTS "PrivateAsset_organizationId_appType_status_idx"
  ON "PrivateAsset"("organizationId", "appType", "status");
CREATE INDEX IF NOT EXISTS "PrivateAsset_organizationId_createdAt_idx"
  ON "PrivateAsset"("organizationId", "createdAt");

-- UsageEvent was introduced by the connector architecture but older AppAI
-- production databases may predate that rollout. Create the base table when
-- absent, then converge both old and new databases on the Phase 1 shape.
CREATE TABLE IF NOT EXISTS "UsageEvent" (
  "id" TEXT NOT NULL,
  "connector" TEXT NOT NULL,
  "userId" TEXT,
  "organizationId" TEXT,
  "action" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "UsageEvent" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "UsageEvent_connector_userId_createdAt_idx"
  ON "UsageEvent"("connector", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageEvent_connector_createdAt_idx"
  ON "UsageEvent"("connector", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageEvent_connector_organizationId_createdAt_idx"
  ON "UsageEvent"("connector", "organizationId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UsageEvent_organizationId_fkey'
  ) THEN
    ALTER TABLE "UsageEvent"
      ADD CONSTRAINT "UsageEvent_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

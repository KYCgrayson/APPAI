BEGIN;

ALTER TABLE "AppRelease" ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'REPOSITORY';

CREATE TABLE IF NOT EXISTS "AppReleasePackage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "appType" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "expectedSizeBytes" INTEGER NOT NULL,
    "actualSizeBytes" INTEGER,
    "sourceDigest" TEXT,
    "contentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "releaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppReleasePackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppReleasePackage_pathname_key" ON "AppReleasePackage"("pathname");
CREATE UNIQUE INDEX IF NOT EXISTS "AppReleasePackage_releaseId_key" ON "AppReleasePackage"("releaseId");
CREATE INDEX IF NOT EXISTS "AppReleasePackage_organizationId_appType_status_expiresAt_idx" ON "AppReleasePackage"("organizationId", "appType", "status", "expiresAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppReleasePackage_organizationId_fkey') THEN
    ALTER TABLE "AppReleasePackage" ADD CONSTRAINT "AppReleasePackage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppReleasePackage_releaseId_fkey') THEN
    ALTER TABLE "AppReleasePackage" ADD CONSTRAINT "AppReleasePackage_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "AppRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppRelease_sourceType_check') THEN
    ALTER TABLE "AppRelease" ADD CONSTRAINT "AppRelease_sourceType_check" CHECK ("sourceType" IN ('REPOSITORY', 'PACKAGE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppReleasePackage_status_check') THEN
    ALTER TABLE "AppReleasePackage" ADD CONSTRAINT "AppReleasePackage_status_check" CHECK ("status" IN ('UPLOADING', 'CONSUMED', 'EXPIRED'));
  END IF;
END $$;

COMMIT;

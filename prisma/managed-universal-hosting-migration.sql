BEGIN;

ALTER TABLE "AppDeployment" ALTER COLUMN "runtimeBaseUrl" DROP NOT NULL;
ALTER TABLE "AppRelease" ADD COLUMN IF NOT EXISTS "sourceRepoUrl" TEXT;
UPDATE "AppRelease" AS release
SET "sourceRepoUrl" = app."repoUrl"
FROM "App" AS app
WHERE release."appId" = app."id" AND release."sourceRepoUrl" IS NULL;

CREATE TABLE "AppManagedRuntime" (
  "id" TEXT NOT NULL,
  "appDeploymentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'VERCEL',
  "providerProjectId" TEXT,
  "providerDeploymentId" TEXT,
  "publicRuntimeUrl" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "approvedCapabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "databaseProvision" JSONB,
  "provisionedAt" TIMESTAMP(3),
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppManagedRuntime_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppManagedRuntime_appDeploymentId_key" ON "AppManagedRuntime"("appDeploymentId");
CREATE INDEX "AppManagedRuntime_provider_providerProjectId_idx" ON "AppManagedRuntime"("provider", "providerProjectId");
CREATE INDEX "AppManagedRuntime_provider_providerDeploymentId_idx" ON "AppManagedRuntime"("provider", "providerDeploymentId");
ALTER TABLE "AppManagedRuntime" ADD CONSTRAINT "AppManagedRuntime_appDeploymentId_fkey" FOREIGN KEY ("appDeploymentId") REFERENCES "AppDeployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

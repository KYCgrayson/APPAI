BEGIN;

-- CreateTable
CREATE TABLE "AppRelease" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "sourceRevision" TEXT,
    "artifactDigest" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppDeployment" (
    "id" TEXT NOT NULL,
    "appReleaseId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "runtimeBaseUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROVISIONING',
    "healthCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppCapabilityGrant" (
    "id" TEXT NOT NULL,
    "organizationAppId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppCapabilityGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppLaunchCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "organizationAppId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "returnPath" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppLaunchCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppRuntimeSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "organizationAppId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRuntimeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppRelease_appId_status_createdAt_idx" ON "AppRelease"("appId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppRelease_appId_version_key" ON "AppRelease"("appId", "version");

-- CreateIndex
CREATE INDEX "AppDeployment_environment_status_createdAt_idx" ON "AppDeployment"("environment", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppDeployment_appReleaseId_environment_key" ON "AppDeployment"("appReleaseId", "environment");

-- CreateIndex
CREATE INDEX "AppCapabilityGrant_capability_status_idx" ON "AppCapabilityGrant"("capability", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppCapabilityGrant_organizationAppId_capability_key" ON "AppCapabilityGrant"("organizationAppId", "capability");

-- CreateIndex
CREATE UNIQUE INDEX "AppLaunchCode_codeHash_key" ON "AppLaunchCode"("codeHash");

-- CreateIndex
CREATE INDEX "AppLaunchCode_organizationAppId_expiresAt_idx" ON "AppLaunchCode"("organizationAppId", "expiresAt");

-- CreateIndex
CREATE INDEX "AppLaunchCode_deploymentId_expiresAt_idx" ON "AppLaunchCode"("deploymentId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppRuntimeSession_tokenHash_key" ON "AppRuntimeSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AppRuntimeSession_organizationAppId_expiresAt_idx" ON "AppRuntimeSession"("organizationAppId", "expiresAt");

-- CreateIndex
CREATE INDEX "AppRuntimeSession_deploymentId_expiresAt_idx" ON "AppRuntimeSession"("deploymentId", "expiresAt");

-- AddForeignKey
ALTER TABLE "AppRelease" ADD CONSTRAINT "AppRelease_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppDeployment" ADD CONSTRAINT "AppDeployment_appReleaseId_fkey" FOREIGN KEY ("appReleaseId") REFERENCES "AppRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppCapabilityGrant" ADD CONSTRAINT "AppCapabilityGrant_organizationAppId_fkey" FOREIGN KEY ("organizationAppId") REFERENCES "OrganizationApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppLaunchCode" ADD CONSTRAINT "AppLaunchCode_organizationAppId_fkey" FOREIGN KEY ("organizationAppId") REFERENCES "OrganizationApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppLaunchCode" ADD CONSTRAINT "AppLaunchCode_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "AppDeployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppRuntimeSession" ADD CONSTRAINT "AppRuntimeSession_organizationAppId_fkey" FOREIGN KEY ("organizationAppId") REFERENCES "OrganizationApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppRuntimeSession" ADD CONSTRAINT "AppRuntimeSession_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "AppDeployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Platform state constraints
ALTER TABLE "AppRelease" ADD CONSTRAINT "AppRelease_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'RETIRED'));
ALTER TABLE "AppDeployment" ADD CONSTRAINT "AppDeployment_environment_check" CHECK ("environment" IN ('PREVIEW', 'PRODUCTION'));
ALTER TABLE "AppDeployment" ADD CONSTRAINT "AppDeployment_status_check" CHECK ("status" IN ('PROVISIONING', 'ACTIVE', 'FAILED', 'RETIRED'));
ALTER TABLE "AppCapabilityGrant" ADD CONSTRAINT "AppCapabilityGrant_status_check" CHECK ("status" IN ('ACTIVE', 'SUSPENDED'));
ALTER TABLE "AppLaunchCode" ADD CONSTRAINT "AppLaunchCode_expiry_check" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "AppRuntimeSession" ADD CONSTRAINT "AppRuntimeSession_expiry_check" CHECK ("expiresAt" > "createdAt");

COMMIT;

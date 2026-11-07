CREATE TABLE "Feedback" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL CHECK ("source" IN ('agent', 'web')),
  "kind" TEXT NOT NULL CHECK ("kind" IN ('missing_feature', 'bug', 'docs', 'other')),
  "message" VARCHAR(4000) NOT NULL CHECK (char_length("message") BETWEEN 10 AND 4000),
  "pageSlug" TEXT, "specUrl" TEXT, "contactEmail" TEXT NOT NULL,
  "organizationId" TEXT, "userId" TEXT, "apiKeyId" TEXT,
  "ipHash" TEXT, "userAgent" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new' CHECK ("status" IN ('new', 'read', 'done'))
);
CREATE INDEX "Feedback_apiKeyId_createdAt_idx" ON "Feedback"("apiKeyId", "createdAt");
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

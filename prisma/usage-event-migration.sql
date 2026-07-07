-- Generic UsageEvent table for interactive-tool connectors (P1).
-- Apply to the production Neon DB. Idempotent.
CREATE TABLE IF NOT EXISTS "UsageEvent" (
    "id"        TEXT NOT NULL,
    "connector" TEXT NOT NULL,
    "userId"    TEXT,
    "action"    TEXT NOT NULL,
    "meta"      JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "UsageEvent_connector_userId_createdAt_idx"
    ON "UsageEvent"("connector", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageEvent_connector_createdAt_idx"
    ON "UsageEvent"("connector", "createdAt");

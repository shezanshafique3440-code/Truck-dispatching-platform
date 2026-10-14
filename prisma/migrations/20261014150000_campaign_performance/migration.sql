BEGIN;
CREATE TYPE "PerformanceState" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');
ALTER TABLE "Campaign" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC', ADD COLUMN "tracksLoads" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PerformanceEntry"
  ADD COLUMN "workTimezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN "callsMade" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "followUpsCompleted" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "qualifiedLeads" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "carriersSigned" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loadsRelevant" BOOLEAN NOT NULL DEFAULT true,
  ALTER COLUMN "loads" DROP NOT NULL,
  ALTER COLUMN "grossRevenue" DROP NOT NULL,
  ALTER COLUMN "grossRevenue" TYPE DECIMAL(18,2),
  ADD COLUMN "dispatchFees" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "refunds" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "adjustments" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "state" "PerformanceState" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT;
-- Existing submissions have no approval evidence. Never fabricate an approval or fees.
UPDATE "PerformanceEntry" SET "state"='SUBMITTED', "submittedAt"="createdAt";
DROP INDEX "PerformanceEntry_dispatcherId_date_key";
CREATE UNIQUE INDEX "PerformanceEntry_dispatcherId_campaignId_date_key"
  ON "PerformanceEntry"("dispatcherId","campaignId","date") NULLS NOT DISTINCT;
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_activity_nonnegative" CHECK ("callsMade">=0 AND "followUpsCompleted">=0 AND "qualifiedLeads">=0 AND "carriersSigned">=0);
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_fees_nonnegative" CHECK ("dispatchFees">=0 AND "refunds">=0);
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_version_positive" CHECK ("version">0);
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_approval_evidence" CHECK (
  ("state"='DRAFT' AND "submittedAt" IS NULL AND "approvedAt" IS NULL AND "approvedById" IS NULL) OR
  ("state"='SUBMITTED' AND "submittedAt" IS NOT NULL AND "approvedAt" IS NULL AND "approvedById" IS NULL) OR
  ("state"='APPROVED' AND "submittedAt" IS NOT NULL AND "approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL AND "campaignId" IS NOT NULL AND "teamId" IS NOT NULL)
);
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_load_relevance" CHECK (("loadsRelevant" AND "loads" IS NOT NULL) OR (NOT "loadsRelevant" AND "loads" IS NULL));
CREATE INDEX "PerformanceEntry_state_currency_campaignId_date_idx" ON "PerformanceEntry"("state","currency","campaignId","date");
CREATE INDEX "PerformanceEntry_teamId_state_date_idx" ON "PerformanceEntry"("teamId","state","date");
COMMIT;

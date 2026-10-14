BEGIN;
-- Preserve the old CLOSED records as LOST: historical closure did not record a win.
-- Operators can review these records and correct the final status with an audit event.
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_legacy";
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'ONBOARDING', 'WON', 'LOST');
ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus"
  USING (CASE WHEN "status"::text = 'CLOSED' THEN 'LOST' ELSE "status"::text END)::"LeadStatus";
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW';
DROP TYPE "LeadStatus_legacy";
CREATE TYPE "LeadSource" AS ENUM ('MANUAL', 'CONSULTATION');
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'PHONE');
CREATE TYPE "InquiryNotificationStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING', 'SENT', 'FAILED');
ALTER TABLE "Lead"
  ADD COLUMN "companyName" TEXT,
  ADD COLUMN "equipmentType" TEXT,
  ADD COLUMN "fleetSize" INTEGER,
  ADD COLUMN "preferredContactMethod" "ContactMethod",
  ADD COLUMN "message" TEXT,
  ADD COLUMN "source" "LeadSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "teamId" TEXT,
  ADD COLUMN "followUpDate" DATE,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "submissionKey" TEXT,
  ADD COLUMN "submissionHash" TEXT,
  ADD COLUMN "notificationStatus" "InquiryNotificationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "notificationAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "notifiedAt" TIMESTAMP(3),
  ALTER COLUMN "campaignId" DROP NOT NULL;
UPDATE "Lead" l SET "teamId" = c."teamId" FROM "Campaign" c WHERE l."campaignId" = c."id";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_fleetSize_check" CHECK ("fleetSize" IS NULL OR "fleetSize" BETWEEN 1 AND 10000);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_version_check" CHECK ("version" > 0);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignment_requires_team" CHECK (("campaignId" IS NULL AND "assignedToId" IS NULL) OR "teamId" IS NOT NULL);
CREATE UNIQUE INDEX "Lead_submissionKey_key" ON "Lead"("submissionKey");
CREATE INDEX "Lead_teamId_status_createdAt_idx" ON "Lead"("teamId", "status", "createdAt");
CREATE INDEX "Lead_source_status_createdAt_idx" ON "Lead"("source", "status", "createdAt");
CREATE INDEX "Lead_followUpDate_idx" ON "Lead"("followUpDate");
CREATE TABLE "LeadNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LeadNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");
COMMIT;

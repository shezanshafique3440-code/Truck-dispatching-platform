ALTER TYPE "EntrySource" ADD VALUE 'IMPORT';
CREATE TYPE "ImportState" AS ENUM ('STAGED', 'COMMITTED');
ALTER TABLE "ImportBatch"
  ADD COLUMN "campaignId" TEXT,
  ADD COLUMN "teamId" TEXT,
  ADD COLUMN "fileType" TEXT,
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "requestKey" TEXT,
  ADD COLUMN "state" "ImportState" NOT NULL DEFAULT 'STAGED',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "headers" JSONB,
  ADD COLUMN "mapping" JSONB,
  ADD COLUMN "totalRows" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "validRows" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "invalidRows" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "committedAt" TIMESTAMP(3);
-- Preserve historical import provenance without fabricating a preview or review.
UPDATE "ImportBatch" SET "state" = 'COMMITTED', "committedAt" = "createdAt";
CREATE UNIQUE INDEX "ImportBatch_requestKey_key" ON "ImportBatch"("requestKey");
CREATE UNIQUE INDEX "ImportBatch_importedById_campaignId_contentHash_key" ON "ImportBatch"("importedById", "campaignId", "contentHash");
CREATE INDEX "ImportBatch_importedById_createdAt_idx" ON "ImportBatch"("importedById", "createdAt");
CREATE INDEX "ImportBatch_teamId_campaignId_createdAt_idx" ON "ImportBatch"("teamId", "campaignId", "createdAt");
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_counts_check" CHECK ("totalRows" >= 0 AND "validRows" >= 0 AND "invalidRows" >= 0 AND "validRows" + "invalidRows" <= "totalRows" AND "version" > 0);
CREATE TABLE "ImportRow" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "cells" JSONB NOT NULL,
  "parseErrors" JSONB NOT NULL,
  "errors" JSONB NOT NULL,
  "normalized" JSONB,
  "valid" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportRow_rowNumber_check" CHECK ("rowNumber" >= 2 AND "rowNumber" <= 1001)
);
CREATE UNIQUE INDEX "ImportRow_batchId_rowNumber_key" ON "ImportRow"("batchId", "rowNumber");
CREATE INDEX "ImportRow_batchId_valid_rowNumber_idx" ON "ImportRow"("batchId", "valid", "rowNumber");
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceEntry" ADD COLUMN "importRowId" TEXT;
CREATE UNIQUE INDEX "PerformanceEntry_importRowId_key" ON "PerformanceEntry"("importRowId");
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "ImportRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

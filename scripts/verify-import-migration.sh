#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_database="northlane_import_migration_${RANDOM}_${RANDOM}_test"
container="dispatch-foundation-postgres"
created=false
cleanup() { if "$created"; then docker exec "$container" dropdb -U postgres "$test_database"; fi; }
trap cleanup EXIT
docker exec "$container" createdb -U postgres "$test_database"
created=true
for migration in prisma/migrations/20261014093948_foundation/migration.sql prisma/migrations/20261014102500_secure_workspace/migration.sql prisma/migrations/20261014130000_consultation_leads/migration.sql prisma/migrations/20261014150000_campaign_performance/migration.sql; do
 docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" < "$migration"
done
docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" <<'SQL'
INSERT INTO "Team" (id,name,"updatedAt") VALUES ('migration-team','Isolated migration team',now());
INSERT INTO "User" (id,email,name,"updatedAt") VALUES ('migration-dispatcher','migration@example.invalid','Isolated dispatcher',now());
INSERT INTO "Campaign" (id,name,"teamId","updatedAt") VALUES ('migration-campaign','Isolated campaign','migration-team',now());
INSERT INTO "ImportBatch" (id,"fileName","importedById","createdAt") VALUES ('legacy-batch','legacy.xlsx','migration-dispatcher','2026-01-01');
INSERT INTO "PerformanceEntry" (id,"dispatcherId","teamId","campaignId",date,loads,"dispatchFees","grossRevenue",currency,"submittedById","updatedAt",source,"importBatchId") VALUES ('legacy-performance','migration-dispatcher','migration-team','migration-campaign','2026-10-01',2,1234.56,1234567890.12,'CAD','migration-dispatcher',now(),'EXCEL','legacy-batch');
SQL
for migration in prisma/migrations/20261014203000_performance_import/migration.sql prisma/migrations/20261014203100_import_preview_context/migration.sql prisma/migrations/20261014203200_import_role_snapshot/migration.sql; do
 docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" < "$migration"
done
docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" <<'SQL'
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "PerformanceEntry" WHERE id='legacy-performance' AND "grossRevenue"=1234567890.12 AND "dispatchFees"=1234.56 AND currency='CAD' AND source='EXCEL' AND "importBatchId"='legacy-batch' AND "state"='DRAFT') THEN RAISE EXCEPTION 'Existing record, money, currency or legacy import provenance changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "ImportBatch" WHERE id='legacy-batch' AND "fileName"='legacy.xlsx' AND state='COMMITTED' AND "committedAt"="createdAt" AND "campaignId" IS NULL AND headers IS NULL) THEN RAISE EXCEPTION 'Legacy batch preservation failed'; END IF;
 IF EXISTS(SELECT 1 FROM "ImportRow") THEN RAISE EXCEPTION 'Fabricated legacy preview rows'; END IF;
END $$;
INSERT INTO "ImportBatch" (id,"fileName","importedById","campaignId","teamId","contentHash","requestKey") VALUES ('new-batch','new.csv','migration-dispatcher','migration-campaign','migration-team','hash','request');
DO $$ BEGIN
 BEGIN
  INSERT INTO "ImportBatch" (id,"fileName","importedById","campaignId","contentHash") VALUES ('duplicate','duplicate.csv','migration-dispatcher','migration-campaign','hash');
  RAISE EXCEPTION 'Batch fingerprint uniqueness missing';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO "ImportRow" (id,"batchId","rowNumber",cells,"parseErrors",errors) VALUES ('bad-row','new-batch',1002,'[]','[]','[]');
  RAISE EXCEPTION 'Preview row bound missing';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SQL
echo 'PASS: existing decimal values and legacy import provenance preserved; no invented preview/approval; batch fingerprint and row constraints verified.'

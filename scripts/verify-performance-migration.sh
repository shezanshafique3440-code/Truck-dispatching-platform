#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_database="northlane_performance_migration_${RANDOM}_${RANDOM}_test"
container="dispatch-foundation-postgres"
created=false
cleanup() { if "$created"; then docker exec "$container" dropdb -U postgres "$test_database"; fi; }
trap cleanup EXIT
docker exec "$container" createdb -U postgres "$test_database"
created=true
for migration in prisma/migrations/20261014093948_foundation/migration.sql prisma/migrations/20261014102500_secure_workspace/migration.sql prisma/migrations/20261014130000_consultation_leads/migration.sql; do
 docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" < "$migration"
done
docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" <<'SQL'
INSERT INTO "Team" (id,name,"updatedAt") VALUES ('migration-team','Isolated migration team',now());
INSERT INTO "User" (id,email,name,"updatedAt") VALUES ('migration-user','migration@example.invalid','Isolated dispatcher',now());
INSERT INTO "Campaign" (id,name,"teamId","updatedAt") VALUES ('migration-campaign','Isolated campaign','migration-team',now());
INSERT INTO "PerformanceEntry" (id,"dispatcherId","teamId","campaignId",date,loads,"grossRevenue",currency,"submittedById","updatedAt") VALUES ('legacy-performance','migration-user','migration-team','migration-campaign','2026-10-01',2,1234567890.12,'USD','migration-user',now());
INSERT INTO "PerformanceEntry" (id,"dispatcherId",date,loads,"grossRevenue",currency,"submittedById","updatedAt") VALUES ('legacy-unassigned','migration-user','2026-10-02',1,12.34,'CAD','migration-user',now());
SQL
docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" < prisma/migrations/20261014150000_campaign_performance/migration.sql
docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" <<'SQL'
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "PerformanceEntry" WHERE id='legacy-performance' AND "grossRevenue"=1234567890.12 AND "dispatchFees"=0 AND "refunds"=0 AND "state"='SUBMITTED' AND "approvedById" IS NULL AND "teamId"='migration-team' AND "campaignId"='migration-campaign') THEN RAISE EXCEPTION 'Historical freight amount or approval state was not preserved'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PerformanceEntry" WHERE id='legacy-unassigned' AND "grossRevenue"=12.34 AND currency='CAD' AND "campaignId" IS NULL AND "state"='SUBMITTED') THEN RAISE EXCEPTION 'Legacy unassigned history was not preserved'; END IF;
 BEGIN
  UPDATE "PerformanceEntry" SET state='APPROVED' WHERE id='legacy-performance';
  RAISE EXCEPTION 'Approval evidence constraint missing';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO "PerformanceEntry" (id,"dispatcherId","campaignId",date,loads,currency,"submittedById","updatedAt") VALUES ('duplicate','migration-user','migration-campaign','2026-10-01',0,'USD','migration-user',now());
  RAISE EXCEPTION 'Daily campaign unique constraint missing';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO "PerformanceEntry" (id,"dispatcherId",date,loads,currency,"submittedById","updatedAt") VALUES ('duplicate-null','migration-user','2026-10-02',0,'CAD','migration-user',now());
  RAISE EXCEPTION 'Null-campaign historical uniqueness missing';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
INSERT INTO "Campaign" (id,name,"teamId","updatedAt") VALUES ('another-campaign','Another isolated campaign','migration-team',now());
INSERT INTO "PerformanceEntry" (id,"dispatcherId","campaignId",date,loads,currency,"submittedById","updatedAt") VALUES ('same-date-other-campaign','migration-user','another-campaign','2026-10-01',0,'USD','migration-user',now());
SQL
echo 'PASS: historical decimal freight revenue, currency, team and campaign preserved without fabricated approvals/fees; campaign uniqueness and approval evidence verified.'

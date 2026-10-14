#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Disposable local-only database; never accepts a supplied production connection.
test_database="northlane_lead_migration_${RANDOM}_${RANDOM}_test"
container="dispatch-foundation-postgres"
created=false
cleanup() { if "$created"; then docker exec "$container" dropdb -U postgres "$test_database"; fi; }
trap cleanup EXIT
docker exec "$container" createdb -U postgres "$test_database"
created=true
for migration in prisma/migrations/20261014093948_foundation/migration.sql prisma/migrations/20261014102500_secure_workspace/migration.sql; do
  docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" < "$migration"
done
docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" <<'SQL'
INSERT INTO "Team" (id,name,"updatedAt") VALUES ('migration-team','Isolated migration fixture',now());
INSERT INTO "User" (id,email,name,"updatedAt") VALUES ('migration-user','migration@example.invalid','Isolated dispatcher',now());
INSERT INTO "Campaign" (id,name,"teamId","updatedAt") VALUES ('migration-campaign','Isolated campaign','migration-team',now());
INSERT INTO "Lead" (id,name,status,"campaignId","assignedToId",notes,"updatedAt") VALUES ('migration-lead','Isolated contact','CLOSED','migration-campaign','migration-user','Existing private summary',now());
SQL
docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" < prisma/migrations/20261014130000_consultation_leads/migration.sql
docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d "$test_database" <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Lead" WHERE id='migration-lead' AND status='LOST' AND "teamId"='migration-team' AND "campaignId"='migration-campaign' AND "assignedToId"='migration-user' AND notes='Existing private summary' AND source='MANUAL' AND version=1) THEN
    RAISE EXCEPTION 'Legacy lead migration did not preserve data';
  END IF;
END $$;
INSERT INTO "Lead" (id,name,source,"updatedAt") VALUES ('new-untriaged','Isolated public inquiry','CONSULTATION',now());
DO $$ BEGIN
  BEGIN
    INSERT INTO "Lead" (id,name,"fleetSize","updatedAt") VALUES ('bad-fleet','Invalid fixture',0,now());
    RAISE EXCEPTION 'Fleet size constraint missing';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO "Lead" (id,name,"assignedToId","updatedAt") VALUES ('bad-assignment','Invalid fixture','migration-user',now());
    RAISE EXCEPTION 'Team assignment constraint missing';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SQL
echo 'PASS: legacy CLOSED lead, team/campaign/dispatcher and private notes preserved; untriaged inquiry and database constraints verified.'

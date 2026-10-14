#!/usr/bin/env bash
set -euo pipefail
[[ $# == 3 && "$1" == --to-new-database && -f "$3" ]] || { echo 'Usage: bash scripts/db-restore-new.sh --to-new-database UNIQUE_DATABASE /private/backup.dump' >&2; exit 1; }
restore_database=$2
[[ "$restore_database" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || { echo 'Use a lowercase PostgreSQL database identifier.' >&2; exit 1; }
archive=$(realpath -- "$3")
[[ -f "$archive.sha256" ]] || { echo 'The backup checksum file is required beside the archive.' >&2; exit 1; }
# Require the checksum for this exact archive, not a checksum naming another file.
actual_checksum=$(cd -- "$(dirname -- "$archive")" && sha256sum -- "$(basename -- "$archive")")
[[ "$(cat -- "$archive.sha256")" == "$actual_checksum" ]] || { echo 'Archive checksum mismatch; no database was changed.' >&2; exit 1; }
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
active_database=$(bash "$repo_dir/scripts/vps-compose.sh" config --format json | python3 -c 'import json,sys; from urllib.parse import urlsplit; print(urlsplit(json.load(sys.stdin)["services"]["app"]["environment"]["DATABASE_URL"]).path.lstrip("/"))')
# CREATE DATABASE fails if the target exists. Never drop or overwrite an existing DB.
bash "$repo_dir/scripts/vps-compose.sh" exec -T db sh -ec '
  target=$1
  [ "$target" != "$POSTGRES_DB" ] && [ "$target" != "$2" ] || { echo "Refusing to restore over an active database." >&2; exit 1; }
  export PGPASSWORD="$POSTGRES_PASSWORD"
  exec psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v target="$target" -v owner="$APP_DB_USER"
' sh "$restore_database" "$active_database" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'target', :'owner') \gexec
SQL
# Cleanup is confined to the newly created, previously nonexistent target database.
bash "$repo_dir/scripts/vps-compose.sh" exec -T db sh -ec 'export PGPASSWORD="$APP_DB_PASSWORD"; exec pg_restore -h 127.0.0.1 -U "$APP_DB_USER" --dbname "$1" --clean --if-exists --no-owner --no-acl --exit-on-error --single-transaction' sh "$restore_database" < "$archive"
echo "Restored to new database: $restore_database. Active app was not switched. Verify before changing APP_DATABASE_NAME."

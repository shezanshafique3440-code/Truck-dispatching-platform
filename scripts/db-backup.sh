#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $# == 1 && -d "$1" ]] || { echo 'Usage: bash scripts/db-backup.sh /existing/private/backup-directory' >&2; exit 1; }
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
backup_dir=$(cd -- "$1" && pwd)
# Parse only the active database name; never display Compose's credential-bearing JSON.
active_database=$(bash "$repo_dir/scripts/vps-compose.sh" config --format json | python3 -c 'import json,sys; from urllib.parse import urlsplit; print(urlsplit(json.load(sys.stdin)["services"]["app"]["environment"]["DATABASE_URL"]).path.lstrip("/"))')
temporary=$(mktemp "$backup_dir/northlane-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump.tmp")
trap 'rm -f -- "$temporary"' EXIT
bash "$repo_dir/scripts/vps-compose.sh" exec -T db sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$1" --format=custom --no-owner --no-acl' sh "$active_database" > "$temporary"
# Validate the archive before marking it complete; no SQL is executed by --list.
bash "$repo_dir/scripts/vps-compose.sh" exec -T db pg_restore --list < "$temporary" > /dev/null
finished=${temporary%.tmp}
mv -- "$temporary" "$finished"
cd "$backup_dir"
sha256sum -- "$(basename -- "$finished")" > "$(basename -- "$finished").sha256"
echo "Backup and checksum saved privately: $finished"

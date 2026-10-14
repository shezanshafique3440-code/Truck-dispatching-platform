#!/usr/bin/env bash
set -euo pipefail
# Local development only. Never use this passwordless container in production.
# The database is published ONLY on loopback; application accounts still require invitations/passwords.
container_name=dispatch-foundation-postgres
if docker inspect "$container_name" >/dev/null 2>&1; then
  image_name=$(docker inspect --format '{{.Config.Image}}' "$container_name")
  if [[ "$image_name" != postgres:17 ]]; then
    echo 'An unexpected container already uses this name; leave it unchanged.' >&2
    exit 1
  fi
  if [[ $(docker inspect --format '{{.State.Running}}' "$container_name") != true ]]; then
    docker start "$container_name" >/dev/null
  fi
else
  docker run --name "$container_name" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=dispatch_development -p 127.0.0.1:5432:5432 -d postgres:17 >/dev/null
fi
for attempt in {1..30}; do
  if docker exec "$container_name" pg_isready -U postgres -d dispatch_development >/dev/null 2>&1; then
    echo 'Local development PostgreSQL is ready.'
    exit 0
  fi
  sleep 1
done
echo 'Local PostgreSQL did not become ready. Inspect the container startup before retrying.' >&2
exit 1

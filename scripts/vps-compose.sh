#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"
deployment_env=${DISPATCH_ENV_FILE:-.env.production}
[[ -f "$deployment_env" ]] || { echo 'Set DISPATCH_ENV_FILE to the private production env file (or create .env.production).' >&2; exit 1; }
compose_options=(--env-file "$deployment_env" -f "$repo_dir/compose.production.yml")
if [[ -n ${DISPATCH_COMPOSE_OVERRIDE:-} ]]; then
  [[ -f "$DISPATCH_COMPOSE_OVERRIDE" ]] || { echo 'DISPATCH_COMPOSE_OVERRIDE must name a reviewed existing override file.' >&2; exit 1; }
  compose_options+=(-f "$DISPATCH_COMPOSE_OVERRIDE")
fi
exec docker compose "${compose_options[@]}" "$@"

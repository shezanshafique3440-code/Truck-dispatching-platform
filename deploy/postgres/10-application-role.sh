#!/usr/bin/env bash
set -euo pipefail
# Runs only for this project's fresh volume. Never changes an existing database.
[[ ${APP_DB_USER:-} =~ ^[a-z][a-z0-9_]{0,62}$ ]] || { echo 'APP_DB_USER must be a lowercase PostgreSQL identifier.' >&2; exit 1; }
[[ ${APP_DB_PASSWORD:-} =~ ^[a-f0-9]{64,128}$ ]] || { echo 'APP_DB_PASSWORD must be 64–128 random hex characters.' >&2; exit 1; }
[[ "$APP_DB_USER" != "$POSTGRES_USER" ]] || { echo 'Use different application and maintenance roles.' >&2; exit 1; }
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_user APP_DB_USER
\getenv app_password APP_DB_PASSWORD
\getenv database POSTGRES_DB
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'app_user', :'app_password') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'database', :'app_user') \gexec
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user') \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL

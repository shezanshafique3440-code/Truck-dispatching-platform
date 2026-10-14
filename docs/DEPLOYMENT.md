# Ubuntu VPS deployment

Preparation only: no actual server, DNS, proxy, certificate or external deployment was modified. Commands marked **VPS only** require your real machine/domain. Replace every `REPLACE_WITH_...` value before running. See `DEPLOYMENT_CHECKLIST.md` and actual results in `VERIFICATION.md`.

## Production packaging

`Dockerfile` uses locked Node 24 dependencies, Prisma generation and Next.js standalone output. The slim web image runs as `node`; standalone output is enabled only inside Docker, preserving ordinary `npm build/start`. the separate `ops` image contains selected scripts/client/Prisma/tsx for trusted one-off commands and is never exposed as a web service. Build-time secrets are unnecessary: only the approved public origin is a build argument. The runner rejects a runtime `PUBLIC_SITE_URL` different from its build marker. Rebuild for any public-origin change.

Compose supplies a PostgreSQL 17 volume at `/var/lib/postgresql/data`, **no database port**, a private internal database network, a localhost-only app port, a separate cache volume, readiness checks, bounded logs, dropped app capabilities, read-only app root and writable bounded `/tmp`. Fresh-volume initialization creates a separate app database owner with no superuser/role-creation/database-creation privileges. Only the DB service receives the maintenance-role password. App/DB restart `unless-stopped`; `ops` never auto-restarts. Stop periods allow graceful shutdown. Migrations never run automatically on startup. Health failure marks the container unhealthy; Docker does not automatically restart it solely for that state. Monitor readiness and investigate; the restart policy handles process exit/daemon restart while preserving deliberate stops.

Names are scoped by a required unique `COMPOSE_PROJECT_NAME`; no fixed container names or shared external volumes exist. Keep that name, volume, credentials and PostgreSQL major stable. Changing the project name selects different volumes. Never run `down --volumes`, `migrate reset` or `db push` on the VPS. Never point PostgreSQL 18+ at this 17 volume; major upgrades require a planned logical migration/pg_upgrade. Record/pin approved base-image digests for reproducibility, and retain immutable app/ops release tags for rollback.

## Locally testable commands

From the existing checkout, with Node 24:

```sh
set -euo pipefail
npm ci
npm run db:generate
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
bash -n scripts/vps-compose.sh scripts/db-backup.sh scripts/db-restore-new.sh deploy/postgres/10-application-role.sh
```

For a local Docker build/start, use a NEW private configuration and an unused disposable `_test` database/project. Set random secrets, mail empty, `APP_URL=https://localhost:3458`, a free `APP_BIND_PORT`, and explicitly test-only `PUBLIC_SITE_URL=https://container-check.example.invalid`. Images with this test origin cannot be used for launch:

```sh
set -euo pipefail
test ! -e .env.container-check
install -m 0600 .env.example .env.container-check
${EDITOR:-nano} .env.container-check
export DISPATCH_ENV_FILE="$PWD/.env.container-check"
bash scripts/vps-compose.sh config --quiet
bash scripts/vps-compose.sh --profile ops build app ops
bash scripts/vps-compose.sh --profile ops run --rm --no-deps ops node deploy/check-runtime.mjs
bash scripts/vps-compose.sh up -d --wait --wait-timeout 120 db
bash scripts/vps-compose.sh --profile ops run --rm ops npm run db:deploy
bash scripts/vps-compose.sh up -d --wait --wait-timeout 120 app
curl --fail http://127.0.0.1:REPLACE_WITH_LOCAL_APP_PORT/api/health
bash scripts/vps-compose.sh ps
```

Production cookies require HTTPS even when the container receives HTTP from a proxy. Local functional login/save checks require the trusted localhost TLS helper described in `AUTHENTICATION.md`; never disable TLS verification. Test readiness failures, actual inquiries/login, image optimization, DB recreation/persistence and backup/new-database restore. Stop only your local test project with `bash scripts/vps-compose.sh down`. Remove volumes only for an explicitly confirmed disposable local `_test` project, never production. Remove local private env/invitation/certificate files afterward. Existing functional/role/import tests are documented in `APPLICATION_REVIEW.md` and must never run on business data.

An optional trusted proxy/CA can be supplied during builds using Docker's predefined proxy args and the `build_ca` BuildKit secret (mounted only during `npm ci`). Do not echo/bake proxy credentials or disable npm integrity/TLS checks. The cloud's read-only Docker client home can use an isolated `DOCKER_CONFIG` under `/tmp`; preserve shared Docker settings. The normal VPS configuration requires no cloud-specific proxy/DNS override. Actual workarounds/results are documented separately.

## VPS only: prerequisites and release location

Use a supported Ubuntu release and a trusted non-root deployment account with SSH/sudo. Docker access is effectively privileged. Require Docker Engine/Compose v2, Python 3, sha256sum, Bash and enough build disk/RAM. Inspect the actual server first:

```sh
set -euo pipefail
docker version
docker compose version
docker compose ls
sudo ss -ltnp
df -h
free -h
python3 --version
```

Retain any existing Docker/proxy/workloads. If Docker is absent, follow the [official Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/) for its actual version; install Engine, CLI, Buildx and Compose plugin. Do not remove existing containerd/Docker packages or run a convenience installer over other workloads. The following **VPS-only optional commands** are only for an Ubuntu host with no existing container installation; they explicitly refuse installed container packages and existing key/repository files:

```sh
set -euo pipefail
test "$(. /etc/os-release && echo "$ID")" = ubuntu
if command -v docker >/dev/null; then echo 'Keep the existing Docker installation'; exit 1; fi
for dispatch_package in docker.io docker-ce containerd containerd.io runc podman-docker; do
  if dpkg-query -W -f='${Status}' "$dispatch_package" 2>/dev/null | grep -F 'install ok installed' > /dev/null; then echo 'Existing container package; inspect official guidance, do not replace'; exit 1; fi
done
sudo test ! -e /etc/apt/keyrings/northlane-docker.asc
sudo test ! -e /etc/apt/sources.list.d/northlane-docker.sources
sudo apt-get update
sudo apt-get install -y ca-certificates curl python3 gettext-base
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/northlane-docker.asc
sudo chmod a+r /etc/apt/keyrings/northlane-docker.asc
dispatch_codename=$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
dispatch_architecture=$(dpkg --print-architecture)
sudo tee /etc/apt/sources.list.d/northlane-docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $dispatch_codename
Components: stable
Architectures: $dispatch_architecture
Signed-By: /etc/apt/keyrings/northlane-docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl start docker
# Only this trusted deployment account; log out/back in for group membership.
sudo usermod -aG docker "$(id -un)"
```

If Nginx/Certbot is absent, install only when no proxy owns 80/443 and no existing site depends on another server: `sudo apt-get install nginx certbot gettext-base`. If Nginx already exists, preserve it; install only missing Certbot/gettext/Python prerequisites. Use the host's established certificate method if one already exists. The optional container-proxy override requires Compose >=2.24.4.

Use a reviewed published release tag before cloning to the VPS, or transfer a trusted reviewed source bundle. Publishing source to GitHub is separate from deployment; the preparation and verification here have not modified an actual VPS, domain or proxy.

```sh
set -euo pipefail
export DISPATCH_ROOT=/srv/northlane-dispatch
export DISPATCH_RELEASE=REPLACE_WITH_REVIEWED_RELEASE_TAG
case "$DISPATCH_RELEASE" in REPLACE_WITH_*|'') echo 'Set the release first'; exit 1;; esac
test ! -e "$DISPATCH_ROOT"
sudo install -d -m 0750 -o "$(id -u)" -g "$(id -g)" "$DISPATCH_ROOT"
install -d -m 0700 "$DISPATCH_ROOT/config" "$DISPATCH_ROOT/backups" "$DISPATCH_ROOT/private"
install -d -m 0750 "$DISPATCH_ROOT/releases"
git clone --branch "$DISPATCH_RELEASE" --single-branch https://github.com/shezanshafique3440-code/Truck-dispatching-platform.git "$DISPATCH_ROOT/releases/$DISPATCH_RELEASE"
cd "$DISPATCH_ROOT/releases/$DISPATCH_RELEASE"
export DISPATCH_ENV_FILE="$DISPATCH_ROOT/config/production.env"
test ! -e "$DISPATCH_ENV_FILE"
install -m 0600 .env.example "$DISPATCH_ENV_FILE"
${EDITOR:-nano} "$DISPATCH_ENV_FILE"
```

Use a different dedicated root if that example already exists. Never overwrite another website directory or config. Supply:

| Setting | Required production action |
| --- | --- |
| `COMPOSE_PROJECT_NAME` | Unique lowercase installation name; check existing projects/volumes first. |
| `APP_IMAGE`, `OPS_IMAGE`, `IMAGE_TAG` | Unique repositories and a new immutable reviewed release tag, not `latest`. |
| `APP_BIND_PORT` | Free localhost port (default 3108), never a public binding or 80/443. |
| `POSTGRES_USER`, `POSTGRES_DB`, `APP_DB_USER` | Lowercase identifiers; different maintenance/app roles. Preserve after initialization. |
| `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `AUTH_SECRET` | Independent random secrets, each generated privately with `openssl rand -hex 32`. App DB password must be 64–128 hex characters. |
| `APP_URL`, `PUBLIC_SITE_URL` | The same approved exact HTTPS origin for this unified public/private installation, no paths/queries. Public origin must be set before building. Separate public/private hosts require additional routing/application design. |
| `TRUSTED_CLIENT_IP_HEADER` | Empty unless an isolated trusted proxy overwrites it; provided Nginx template supports `x-real-ip`. |
| `APP_DATABASE_NAME` | Initially blank; later only a verified restoration target. |
| Email settings | Empty until provider/sender/recipient are verified. |

Never share secrets in chat/history/build args. Compose ignores the example's local `DATABASE_URL` and constructs the private `db:5432` connection from actual app-role settings. Test variables are not passed to production services. Keep private files 0600 and directories 0700, outside Git. Never display `docker compose config` in logs: use `config --quiet`. Helpers parse credential-bearing JSON internally without printing it.

PostgreSQL initialization scripts run only on a fresh volume. Changing env passwords does not rotate existing roles; rotate actual passwords privately, synchronize config and recreate relevant services in a maintenance window. Do not delete the volume to fix authentication. Preserve secrets across updates and keep encrypted recovery copies separately.

## VPS only: build, explicit migrations, startup

From the selected release with `DISPATCH_ENV_FILE` exported:

```sh
set -euo pipefail
bash scripts/vps-compose.sh config --quiet
bash scripts/vps-compose.sh --profile ops build --pull app ops
bash scripts/vps-compose.sh --profile ops run --rm --no-deps ops node deploy/check-runtime.mjs
bash scripts/vps-compose.sh pull db
bash scripts/vps-compose.sh up -d --wait --wait-timeout 120 db
bash scripts/vps-compose.sh --profile ops run --rm ops npm run db:deploy
# Repeat safely: should report no pending migrations.
bash scripts/vps-compose.sh --profile ops run --rm ops npm run db:deploy
bash scripts/vps-compose.sh up -d --wait --wait-timeout 120 app
bash scripts/vps-compose.sh ps
curl --fail http://127.0.0.1:REPLACE_WITH_APP_BIND_PORT/api/health
```

Replace the curl port. A failed build/migration/readiness is a stop condition. Inspect only this project's bounded logs: `bash scripts/vps-compose.sh logs --tail 100 app db`. Health checks authenticated DB/key tables and returns no data; it does not replace migration history/full functional checks. `ops` is one-off, not a background service. Ordinary restart/recreation/`down` without `--volumes` preserves database/cache storage.

## VPS/domain only: new domain without changing another website

Point only the new domain's A record to the actual VPS; use AAAA only if IPv6 reaches the proxy. Confirm DNS independently. Preserve SSH/other sites' firewall rules; do not reset UFW or expose this app's port/5432. Keep the existing proxy on 80/443. If it is Apache/Caddy/Traefik, add the equivalent new route there rather than installing competing Nginx. For an existing host Nginx, add a separate new site file; never replace `nginx.conf`, remove `default`, use `default_server`, reuse another domain or stop the proxy.

```sh
set -euo pipefail
export DISPATCH_DOMAIN=REPLACE_WITH_APPROVED_DOMAIN
export DISPATCH_APP_PORT=REPLACE_WITH_APP_BIND_PORT
export DISPATCH_SITE=REPLACE_WITH_NEW_UNIQUE_NGINX_SITE_NAME
export TLS_CONTACT_EMAIL=REPLACE_WITH_CERTIFICATE_CONTACT_EMAIL
export DISPATCH_ACME_ROOT="/var/www/$DISPATCH_SITE-acme"
case "$DISPATCH_DOMAIN:$DISPATCH_APP_PORT:$DISPATCH_SITE:$TLS_CONTACT_EMAIL" in *REPLACE_WITH*) echo 'Replace proxy placeholders first'; exit 1;; esac
sudo nginx -t
# If this matches an existing vhost, STOP and inspect ownership; never duplicate it.
if sudo nginx -T 2>/dev/null | grep -F -- "$DISPATCH_DOMAIN" > /dev/null; then echo "Domain already present; stop and inspect ownership."; exit 1; fi
sudo test ! -e "/etc/nginx/sites-available/$DISPATCH_SITE"
sudo test ! -e "/etc/nginx/sites-enabled/$DISPATCH_SITE"
sudo test ! -e "$DISPATCH_ACME_ROOT"
sudo install -d -m 0755 "$DISPATCH_ACME_ROOT"
envsubst '${DISPATCH_DOMAIN} ${DISPATCH_APP_PORT} ${DISPATCH_ACME_ROOT}' < deploy/nginx/http.conf.example > "$DISPATCH_ROOT/private/nginx-http.conf"
sudo install -m 0644 "$DISPATCH_ROOT/private/nginx-http.conf" "/etc/nginx/sites-available/$DISPATCH_SITE"
sudo ln -s "/etc/nginx/sites-available/$DISPATCH_SITE" "/etc/nginx/sites-enabled/$DISPATCH_SITE"
sudo nginx -t && sudo systemctl reload nginx
```

Proceed only after confirming no duplicate domain. Do not sign in/invite users during initial HTTP-only setup. `certonly --webroot` obtains this new site's certificate without rewriting other proxy config:

```sh
set -euo pipefail
sudo test ! -d "/etc/letsencrypt/live/$DISPATCH_DOMAIN"
sudo certbot certonly --webroot -w "$DISPATCH_ACME_ROOT" --cert-name "$DISPATCH_DOMAIN" -d "$DISPATCH_DOMAIN" --email "$TLS_CONTACT_EMAIL" --agree-tos --non-interactive
envsubst '${DISPATCH_DOMAIN} ${DISPATCH_APP_PORT} ${DISPATCH_ACME_ROOT}' < deploy/nginx/https.conf.example > "$DISPATCH_ROOT/private/nginx-https.conf"
# Change ONLY the new site created above; retain its own previous file.
sudo cp -a "/etc/nginx/sites-available/$DISPATCH_SITE" "$DISPATCH_ROOT/private/nginx-before-tls.conf"
sudo install -m 0644 "$DISPATCH_ROOT/private/nginx-https.conf" "/etc/nginx/sites-available/$DISPATCH_SITE"
sudo nginx -t && sudo systemctl reload nginx
curl --fail "https://$DISPATCH_DOMAIN/api/health"
sudo certbot renew --cert-name "$DISPATCH_DOMAIN" --dry-run
systemctl list-timers --all | grep -F certbot
```

Create a new renewal hook (preserve all existing hooks):

```sh
set -euo pipefail
sudo test ! -e "/etc/letsencrypt/renewal-hooks/deploy/$DISPATCH_SITE-reload-nginx"
printf '%s\n' '#!/bin/sh' 'nginx -t && systemctl reload nginx' > "$DISPATCH_ROOT/private/renewal-hook.sh"
sudo install -m 0755 "$DISPATCH_ROOT/private/renewal-hook.sh" "/etc/letsencrypt/renewal-hooks/deploy/$DISPATCH_SITE-reload-nginx"
```

Verify the existing website before/after reload. On syntax failure do not reload: disable only the new site's symlink or restore its saved file, validate and investigate. The templates disable proxy caching/buffering, overwrite client-IP/protocol headers, and allow a 3 MiB request envelope; the app retains its 2 MiB import bound. Never trust forwarded headers from a directly accessible origin.

If the existing proxy runs in Docker, its `127.0.0.1` cannot reach the host-bound app. Use this alternative rather than the host-Nginx commands above. Review the existing trusted network and proxy config, then:

```sh
set -euo pipefail
test ! -e "$DISPATCH_ROOT/config/proxy-network.yml"
install -m 0600 deploy/compose.proxy-network.yml.example "$DISPATCH_ROOT/config/proxy-network.yml"
export PROXY_NETWORK=REPLACE_WITH_EXISTING_TRUSTED_PROXY_NETWORK
case "$PROXY_NETWORK" in REPLACE_WITH_*|'') exit 1;; esac
export DISPATCH_COMPOSE_OVERRIDE="$DISPATCH_ROOT/config/proxy-network.yml"
bash scripts/vps-compose.sh config --quiet
bash scripts/vps-compose.sh up -d --no-deps --wait --wait-timeout 120 app
```

Persist those two shell variables in this installation's operator/job configuration, alongside `DISPATCH_ENV_FILE`, for all later operations. The wrapper applies the reviewed override consistently, including backup helpers. Add only the new domain's route in the existing proxy to `${COMPOSE_PROJECT_NAME}-app:3000`. The override removes this app's host port and attaches only the app to that existing external network; PostgreSQL remains internal. Do not create another listener/proxy or attach the DB. Trust headers only when all origin access is trusted and overwritten. Changing proxy networks/routes requires actual server ownership review; it was not done here.

## VPS/HTTPS only: initial administrator

No default accounts/passwords or business seed exist. After real HTTPS/migrations/readiness:

```sh
set -euo pipefail
export ADMIN_EMAIL=REPLACE_WITH_ACTUAL_ADMIN_EMAIL
case "$ADMIN_EMAIL" in REPLACE_WITH_*|'') echo 'Choose the real admin first'; exit 1;; esac
bash scripts/vps-compose.sh --profile ops run --rm --user "$(id -u):$(id -g)" --volume "$DISPATCH_ROOT/private:/private" ops npm run admin:bootstrap -- --email "$ADMIN_EMAIL" --output /private/first-admin-invitation.txt
chmod 0600 "$DISPATCH_ROOT/private/first-admin-invitation.txt"
```

Read/open the file privately from your own trusted machine, accept with the invited email/name and choose a unique 12–128 character password in the browser. Never paste the token in chat/logs. The link is single-use, expires in one hour, and refuses overwrite/existing Admin/live bootstrap invitation. Remove only this invitation file after successful acceptance/sign-in. Invite the team in Admin → Users, then assign teams/campaigns. This private workflow needs no email provider. See `AUTHENTICATION.md` for expiry/emergency recovery precautions.

## VPS/provider only: optional email

Privately configure `RESEND_API_KEY` and a provider-verified `MAIL_FROM`; add a verified private `INQUIRY_NOTIFICATION_EMAIL` for alerts. Permit outbound HTTPS to `api.resend.com`, verify sender DNS, reset links and actual recipient delivery. Missing settings leave reset honestly unavailable; inquiries still save without alerts. Provider acceptance is not guaranteed mailbox delivery, and failed notification does not undo a saved inquiry. No SMTP variables or credentials are invented.

After editing only provider settings, reload runtime config by recreating only the app:

```sh
set -euo pipefail
bash scripts/vps-compose.sh up -d --no-deps --wait --wait-timeout 120 app
```

## VPS only: backup and restore

Helpers require Bash/Python 3/sha256sum and the running DB container. Backups contain password hashes/sessions/private notes; keep mode 0600, encrypt off-VPS copies, restrict access and establish retention/monitoring. A volume is not a backup. The helper reads the configured active DB even after a restore switch and never prints Compose credentials.

```sh
set -euo pipefail
bash scripts/db-backup.sh "$DISPATCH_ROOT/backups"
export DISPATCH_BACKUP="$DISPATCH_ROOT/backups/REPLACE_WITH_ACTUAL_ARCHIVE.dump"
export RESTORE_DATABASE=REPLACE_WITH_NEW_LOWERCASE_DATABASE
case "$DISPATCH_BACKUP:$RESTORE_DATABASE" in *REPLACE_WITH*) echo 'Choose archive/new target'; exit 1;; esac
bash scripts/db-restore-new.sh --to-new-database "$RESTORE_DATABASE" "$DISPATCH_BACKUP"
```

Archive/checksum validation precedes restoration. Restore refuses the initialized/active DB and any existing target, creates a new app-owned DB, then restores in one transaction. Cleanup applies only to that newly created target's default objects; no active DB is dropped/overwritten/switched. Failure may leave a new empty DB for inspection. Restore only authenticated trusted backups: their SQL executes during restore.

Check migration history, record counts, representative money/state, notes/audits before any switch. In a planned maintenance window stop this app/all its writers, back up current data, set only `APP_DATABASE_NAME` to the verified new target, run that release's explicit `db:deploy`, recreate only the app and validate real functional access. Preserve `POSTGRES_DB`, project/volume/roles and the previous DB. Snapshot recovery loses later activity unless reconciled; never silently discard inquiries/performance.

Schedule backup/pruning through NEW installation-specific cron/systemd jobs with absolute release/config paths and protected output; never replace another site's crontab/timers. Manual pruning:

```sh
set -euo pipefail
bash scripts/vps-compose.sh --profile ops run --rm ops npm run security:prune
```

Regularly rehearse restore to a new DB and retrieve/verify encrypted off-server copies. Scheduling/storage delivery was not configured here.

## VPS only: update

Keep previous source/images/config and pre-migration backup. Review every new migration SQL; use expand/contract changes when old/new app compatibility matters. Preserve project, port, passwords/auth secret and PostgreSQL major. Clone into a NEW release directory, never over a running checkout:

```sh
set -euo pipefail
export DISPATCH_NEW_RELEASE=REPLACE_WITH_REVIEWED_NEW_TAG
case "$DISPATCH_NEW_RELEASE" in REPLACE_WITH_*|'') exit 1;; esac
test ! -e "$DISPATCH_ROOT/releases/$DISPATCH_NEW_RELEASE"
git clone --branch "$DISPATCH_NEW_RELEASE" --single-branch https://github.com/shezanshafique3440-code/Truck-dispatching-platform.git "$DISPATCH_ROOT/releases/$DISPATCH_NEW_RELEASE"
cd "$DISPATCH_ROOT/releases/$DISPATCH_NEW_RELEASE"
export DISPATCH_ENV_FILE="$DISPATCH_ROOT/config/production.env"
test ! -e "$DISPATCH_ROOT/private/config-before-$DISPATCH_NEW_RELEASE.env"
install -m 0600 "$DISPATCH_ENV_FILE" "$DISPATCH_ROOT/private/config-before-$DISPATCH_NEW_RELEASE.env"
${EDITOR:-nano} "$DISPATCH_ENV_FILE"
# Update only IMAGE_TAG/approved image refs; inspect new migration SQL first.
bash scripts/vps-compose.sh config --quiet
bash scripts/vps-compose.sh --profile ops build --pull app ops
bash scripts/vps-compose.sh --profile ops run --rm --no-deps ops node deploy/check-runtime.mjs
bash scripts/vps-compose.sh stop app
# Suspend this installation's scheduled writers in the maintenance window.
bash scripts/db-backup.sh "$DISPATCH_ROOT/backups"
bash scripts/vps-compose.sh --profile ops run --rm ops npm run db:deploy
bash scripts/vps-compose.sh up -d --no-deps --wait --wait-timeout 120 app
```

Validate HTTPS health, genuine inquiry/login/logout/scoped reports and the other website; resume only this app's jobs. One app instance has brief maintenance downtime; production concurrency/zero-downtime is not claimed. Retain old tags; do not run global image/system/volume prune. PostgreSQL minor/security upgrades are separate backup-reviewed maintenance, not an app-update side effect.

## VPS only: rollback and migration precautions

For a schema-compatible image rollback, use the previous release's Compose file and retained immutable app/ops tags with the same project/config/volume. Stop this app and privately change only `IMAGE_TAG` to the compatible retained release:

```sh
set -euo pipefail
bash scripts/vps-compose.sh stop app
${EDITOR:-nano} "$DISPATCH_ENV_FILE"
bash scripts/vps-compose.sh up -d --no-deps --no-build --wait --wait-timeout 120 app
```

Do not rebuild an old tag over new source. Ensure the old image exists or pull its recorded digest from a trusted registry. Image rollback **does not reverse migrations**. Never reset/drop/edit applied history as a pretend down-migration.

For an incompatible schema, keep writers stopped, capture an emergency current backup, restore a selected pre-migration archive to a NEW database and verify it against the retained old app. Deliberately switch `APP_DATABASE_NAME` and `IMAGE_TAG`, validate, reconcile post-backup activity and preserve the failed/current DB. A failed migration requires inspection and an approved repair/forward migration; `migrate resolve` is not an automatic fix. Do not restart other sites or replace their proxy files during rollback.

## Remaining launch configuration

Actual VPS access/resources, approved published release, domain/DNS/TLS, runtime secrets, real Admin, optional email, off-server backups, monitoring and production capacity remain operator work. No demo credentials, fake metrics or unverified company claims are shipped. Official guidance consulted: installed Next.js output/deploying/self-hosting docs; [Docker startup order](https://github.com/docker/docs/blob/main/content/manuals/compose/how-tos/startup-order.md), [Ubuntu installation](https://github.com/docker/docs/blob/main/content/manuals/engine/install/ubuntu.md), [Compose services](https://github.com/docker/docs/blob/main/content/reference/compose-file/services.md), [build proxy variables](https://github.com/docker/docs/blob/main/content/manuals/build/building/variables.md), [Node image](https://github.com/nodejs/docker-node/blob/main/README.md) and [PostgreSQL image](https://github.com/docker-library/docs/blob/master/postgres/README.md). Official source docs were used when the rendered Docker site was unavailable.

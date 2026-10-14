# Deployment checklist

No actual VPS/domain action was performed. `REPLACE_WITH_...` marks operator values. Use the detailed sequencing/precautions in `DEPLOYMENT.md`.

## Locally testable

- [ ] Review/commit the files. This checkout has no Git commit; publish an approved release only when authorized, or prepare a trusted release bundle.
- [ ] Run from the repository:

```sh
npm ci
npm run db:generate
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
```

- [ ] Create a new private local env using the runbook: unique disposable project/`_test` DB, random secrets, no provider settings, clearly test-only public origin.
- [ ] Validate/build without displaying credentials:

```sh
export DISPATCH_ENV_FILE=/absolute/private/REPLACE_WITH_LOCAL_TEST_ENV
bash scripts/vps-compose.sh config --quiet
bash scripts/vps-compose.sh --profile ops build app ops
bash scripts/vps-compose.sh --profile ops run --rm --no-deps ops node deploy/check-runtime.mjs
```

- [ ] Verify fresh/repeated migrations, healthy app/DB, failure states, public and protected requests, persistent data after container recreation, archive checksum and restore to a new DB. Record actual results; clean only disposable fixtures. A local test domain/certificate/image is not a live deployment.

## Requires the actual VPS/domain/operator

- [ ] Inspect existing websites, Docker projects/volumes, listeners, proxy and firewall; reserve a new root/project/images/loopback port. Preserve existing services/configuration.
- [ ] Supply private configuration, three independent secrets, approved HTTPS origin, immutable release tag and PostgreSQL 17 storage. Do not reuse development credentials.
- [ ] In the reviewed server release:

```sh
export DISPATCH_ENV_FILE=/absolute/private/REPLACE_WITH_PRODUCTION_ENV
bash scripts/vps-compose.sh config --quiet
bash scripts/vps-compose.sh --profile ops build --pull app ops
bash scripts/vps-compose.sh --profile ops run --rm --no-deps ops node deploy/check-runtime.mjs
bash scripts/vps-compose.sh pull db
bash scripts/vps-compose.sh up -d --wait --wait-timeout 120 db
bash scripts/vps-compose.sh --profile ops run --rm ops npm run db:deploy
bash scripts/vps-compose.sh up -d --wait --wait-timeout 120 app
curl --fail http://127.0.0.1:REPLACE_WITH_APP_BIND_PORT/api/health
```

- [ ] Point only the new domain's DNS to the VPS. Add a separate route to the existing proxy and obtain TLS without rewriting other sites, using exact commands/templates in `DEPLOYMENT.md`.
- [ ] Check real TLS and the previous website:

```sh
curl --fail https://REPLACE_WITH_APPROVED_DOMAIN/api/health
curl --head https://REPLACE_WITH_EXISTING_WEBSITE_DOMAIN
```

- [ ] Bootstrap the chosen real Admin using the private invitation command; remove the token file after use. Verify invitation-only login/logout, role boundaries and real assignments.
- [ ] Agree retention for real-installation verification; save a permitted inquiry, assign its lead, submit/approve performance and verify exact currency-scoped totals. Do not run destructive fixture suites on this installation.
- [ ] If enabled, verify provider DNS/API access/reset links and actual recipient email delivery. Otherwise preserve the honest unavailable state.
- [ ] Create an encrypted off-VPS backup, restore to a new DB and inspect history/money/notes/audit:

```sh
bash scripts/db-backup.sh /absolute/private/REPLACE_WITH_BACKUP_DIRECTORY
bash scripts/db-restore-new.sh --to-new-database REPLACE_WITH_NEW_LOWERCASE_DATABASE /absolute/private/REPLACE_WITH_ARCHIVE.dump
```

- [ ] Retain previous source/images/config and pre-migration backup; rehearse compatible image rollback and incompatible-schema recovery to a new database.
- [ ] Add only installation-specific backup/pruning/monitoring/renewal jobs and test restart after a planned host reboot. No live scheduler, reboot, provider or external backup delivery was tested here.
- [ ] Confirm company facts/contact/legal/privacy/service content before announcing launch. No testimonials, earnings guarantees or customer counts are supplied.

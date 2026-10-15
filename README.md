# Northlane Dispatch · Truck dispatching platform

Premium English public website and invitation-only team dashboard. Public company facts and proposed copy live in one configuration file. Unknown contact details, pricing, certifications, testimonials and business figures remain unset.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, PostgreSQL, Prisma ORM 7, Better Auth 1.7 and Zod 4. Node.js 24 and npm are required. The lockfile fixes resolved dependency versions.

## Development

```sh
npm ci
cp .env.example .env
# Supply a development DATABASE_URL, random AUTH_SECRET and exact APP_URL securely.
npm run db:generate
npm run db:deploy
npm run dev
```

Public pages render without database/auth credentials. Consultation submission and private login require all three configured runtime values and migrated PostgreSQL. Local HTTP is supported only with `NODE_ENV=development`; production authentication requires the exact HTTPS origin in `APP_URL`. Never put a database URL, auth secret or email key into `NEXT_PUBLIC_*` variables or a committed file.

For a loopback-only disposable development PostgreSQL instance, run `bash scripts/dev-database.sh`. This preserves an existing project container or creates one; it uses local trust authentication and must never be deployed as a production database. Supply a properly secured database connection for production. Cloud onboarding has prepared an ignored, mode-0600 `.env` with a random development auth secret and this local database; preserve it during local work and replace development settings for deployment.

There is no automatic seed or hardcoded administrator. Follow [Authentication setup](docs/AUTHENTICATION.md) to create a private, expiring first-admin invitation with `npm run admin:bootstrap`. Choose the password in the browser. With the local HTTP development origin, prefix the bootstrap command with `NODE_ENV=development`. Additional users must be invited by an authenticated admin.

```sh
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Generate Prisma before typechecking a fresh checkout. Apply committed migrations with `db:deploy`. For future schema edits, create/review migrations in development and preserve historical data. The secure-workspace migration transfers prior team assignments to memberships, backfills performance team context and invalidates old sessions; it does not seed business data.

## What is implemented

- Public routes: Home, Services, How It Works, About and Contact. Responsive navigation/footer and consultation CTAs link to real pages.
- Private auth: invitation-only account creation, maintained-library password hashing/sessions, logout, password change, persistent login throttling and strict server validation.
- Dashboard: role-appropriate navigation, overview, teams/memberships, configurable campaign timezones/load relevance, Leads, daily performance, approved reports/rankings, users/invitations, audit and settings.
- Access: live role/membership/campaign checks on every protected read/mutation, private import preview/confirmation and CSV/XLSX export. Cross-team or unassigned IDs are rejected. Disabling an account revokes sessions while preserving performance.
- Leads: real public consultation saves; private search, filters, 20-row pagination, details, internal notes, audited statuses/assignments and UTC follow-up dates. Overview counters query the full scoped database.
- Operational scripts: first-admin invitation bootstrap and expired security-record cleanup. No production fixtures.

## Configuration

`src/config/company.ts` holds the temporary company name, confirmed contact fields and editable proposed public copy. Toggle an equipment item's `enabled` field to control its display. Confirm actual service scope before launch. The visibly labeled local hero is a generated concept placeholder; provenance is documented in `public/images/README.md`.

`AUTH_SECRET`, `DATABASE_URL` and `APP_URL` enable private auth. Optional `RESEND_API_KEY` plus a verified `MAIL_FROM` enable password reset email. Without them, recovery shows an honest unavailable state and requests return 503. No actual provider delivery has been verified. An optional trusted client-IP header requires an isolated reverse proxy that overwrites it; see the auth guide.

Consultation submissions and private lead management are delivered; see [Lead workflow](docs/LEADS.md). Optional staff alerts additionally require a valid `INQUIRY_NOTIFICATION_EMAIL`; saves work without email and distinguish missing/failed/accepted notifications. CSV/XLSX import with templates, column mapping, private paginated previews, row errors, explicit transactional confirmation and safe retries is delivered; see [Imports and exports](docs/IMPORTS_EXPORTS.md). Imported work starts Draft and enters the same submission/approval workflow. Daily campaign performance includes Draft → Submitted → Approved, owner draft edits, authorized/audited corrections, decimal-safe fees/refunds/adjustments, separate optional freight revenue and explicit currency. Approved dashboard cards, carrier/fee trends, scoped team comparison and daily/weekly/monthly rankings are implemented. See [Performance rules](docs/PERFORMANCE.md) for timezone boundaries, conversion/ranking definitions and limitations. Leads and daily records have 20-row pagination; import history/previews/directories and report comparisons are also paginated at 20. Users have searchable 20-row pagination and uncapped Admin management choices. Other resource tables remain bounded at 50; legacy generic CSV exports cap at 1,000, while new filtered performance/leaderboard CSV/XLSX exports include up to 5,000 and reject larger results with a narrowing prompt. Entry, report and campaign-dispatcher selectors query beyond 50 rows. A local 60-dispatcher concurrent workflow is tested; production capacity on different infrastructure is not assumed.

## Functional auth checks

`npm run test:smoke` runs real HTTP/database checks. It requires a local running app, `TEST_DATABASE_URL` pointing to an **empty dedicated database whose name ends in `_test`**, and `SMOKE_BASE_URL` matching the server origin. The app must use that same test database. The runner exercises the actual bootstrap/invitation flow, creates randomly credentialed test accounts, and cleans up its isolated fixtures. It refuses existing business data before allowing cleanup.

For HTTPS production-mode testing, trust your generated localhost certificate with `NODE_EXTRA_CA_CERTS`. `scripts/local-https-proxy.mjs` is a local-only test helper, never a deployment proxy. See `docs/AUTHENTICATION.md` for the exact flow. Do not run tests against production.

## Browser and presentation review

`npm run test:browser` runs the Playwright/axe review against an empty dedicated local HTTPS `_test` installation. It checks five viewport widths, every public page, role-appropriate dashboard screens, keyboard/focus/reduced-motion states, metadata and the complete inquiry-to-approved-ranking journey. Use an isolated review origin/configuration and never run fixtures on production. See [Application review](docs/APPLICATION_REVIEW.md) for requirements and limits. `PUBLIC_SITE_URL` supplies the approved HTTPS SEO origin before building; unknown/loopback origins stay out of public canonicals, social images and sitemap.

## Documentation

- [Implementation stages](docs/IMPLEMENTATION_STAGES.md)
- [Role policy and architecture](docs/ARCHITECTURE.md)
- [Authentication, bootstrap, credentials and tests](docs/AUTHENTICATION.md)
- [Campaign performance, approval and reporting](docs/PERFORMANCE.md)
- [CSV/XLSX import templates, permissions and exports](docs/IMPORTS_EXPORTS.md)
- [Consultation form, lead permissions and notifications](docs/LEADS.md)
- [Public website and image provenance](docs/PUBLIC_WEBSITE.md)
- [Application review, SEO and browser verification](docs/APPLICATION_REVIEW.md)
- [Actual verification results](docs/VERIFICATION.md)
- [Ubuntu VPS Docker deployment, backups and rollback](docs/DEPLOYMENT.md)
- [Local versus actual-server deployment checklist](docs/DEPLOYMENT_CHECKLIST.md)

## Production containers

Use `Dockerfile` and `compose.production.yml`, rather than the passwordless development database helper. The standalone app runs as a non-root user on an isolated host loopback port; PostgreSQL uses project-scoped persistent storage and publishes no port. One-off `ops` handles reviewed migrations, private Admin invitations and pruning. Runtime secrets stay in a private env file; only the approved public origin is baked into marketing metadata. No migrations or business seeds automatically run on app startup. Follow the runbook/checklist above; actual VPS/DNS/TLS/provider setup remains operator work.

## Dependency notes

Official Next.js, Tailwind PostCSS, Prisma ORM 7 and Better Auth integration documentation was checked before installing the relevant packages. Prisma 7 is the supported stable line used here; Prisma 8 release-candidate instructions are not used.

Scoped overrides pin `@prisma/config`'s `deepmerge-ts` to 8.0.0 and Prisma CLI's `mysql2` to 3.24.6 to resolve reported advisories. Config loading, generation and migrations were tested with these overrides. Runtime audit passes. The previously documented high-severity findings in the development lint-tool `braces` chain remain unresolved; review them when updating Next.js/ESLint rather than applying npm's incompatible downgrade blindly.

## Local DEMO data

For an explicitly opted-in, persistent synthetic workspace (64 dispatchers and 60 days of performance), see [Local DEMO data](docs/DEMO_DATA.md). Run `NODE_ENV=development npm run db:seed:demo -- --confirm-local-demo` only against a migrated loopback development database. Repeat runs preserve existing data; no passwords or login accounts are created and production startup never seeds data. `npm run test:demo` checks seed repeatability and preservation in a separate temporary PostgreSQL database.

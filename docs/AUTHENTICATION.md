# Authentication and secure workspace

## Library and runtime

Better Auth 1.7.7 is installed with its Prisma adapter in transaction mode. Its current official Next.js/Prisma integration, email/password, cookie and rate-limit documentation was read before installation; it explicitly supports Next.js 16 and Prisma 7. Zod 4 validates every accepted application mutation on the server.

- [Official Next.js integration](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/next.mdx)
- [Official Prisma adapter](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/prisma.mdx)
- [Email/password and reset](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/email-password.mdx)
- [Cookies](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/cookies.mdx)
- [Rate limiting](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/rate-limit.mdx)

Configure `DATABASE_URL`, a high-entropy `AUTH_SECRET` of at least 32 characters, and the exact `APP_URL` origin. Production auth rejects HTTP origins. Only development on loopback allows local HTTP. A missing/invalid configuration renders an honest unavailable login state. Public marketing pages still work without auth credentials.

Apply reviewed migrations with `npm run db:deploy`, generate the client with `npm run db:generate`, then start the application. Never point development fixtures at a production database. The second migration preserves prior team assignments as memberships and backfills historical reporting-team IDs; it revokes all previous-format sessions. Historical records without a previous team remain unassigned and visible only to admins and their owner. It never deletes performance data or creates company seed records.

## Bootstrap the first administrator

There are no default accounts or passwords. With secure runtime variables configured and an empty installation, run from the repository root:

```sh
npm run admin:bootstrap -- --email your-approved-address@example.com --output /absolute/private/path/first-admin-invitation.txt
```

Choose a private existing directory **outside the repository**. The command creates the file exclusively with mode 0600; it refuses to overwrite a file. It stores only a SHA-256 token digest in PostgreSQL and records a bootstrap audit event. No raw token or password is printed. Open the saved link privately, enter the invited email and your name, and choose a password of 12–128 characters in the browser. Acceptance creates the admin and a Better Auth `credential` account using the library's scrypt hashing. It then directs you to normal sign-in.

For the local HTTP development origin, run the same command with `NODE_ENV=development`. The loopback-only development database helper is documented in README; it must not be used as a deployment database.

The link expires in one hour and is single-use. The command refuses when any admin already exists or a live bootstrap invitation is pending. An advisory lock and serializable transaction serialize bootstrap acceptance. If the unused link expires, run the command again with a new output filename. Securely remove invitation files after use. Recovery of a lost sole admin is an operator procedure, not an anonymous endpoint; do not remove historical accounts to re-enable bootstrap.

## Invitation-only access

An authenticated admin creates invitations in **Users & invitations**. Invitations choose an email, role and optional initial team memberships. A raw link is returned once to that admin and is not written to logs, audit metadata or local storage. Share it privately with its intended recipient; it expires in 48 hours. The token is in a URL fragment so ordinary HTTP requests and referrer headers do not include it.

Acceptance requires the invited email and a new password. It atomically consumes the invitation and creates the user, credential account, memberships and audit event. Expired, revoked, replayed, wrong-email or inactive-inviter invitations cannot create an account. Public signup is disabled in Better Auth and excluded from the HTTP endpoint allowlist. Native profile/delete-user endpoints are also excluded; role and active fields cannot be selected during signup or login.

Memberships and campaign assignments are separate. Admins assign managers to both their teams and specific campaigns. A manager creating a campaign within an assigned team is automatically assigned to that new campaign. Managers can assign dispatchers only to campaigns they manage and only when the dispatcher is already an active member of that team. Only admins can change global roles or team memberships.

## Sessions and account safety

Better Auth issues signed opaque, host-only HttpOnly cookies with SameSite=Lax, Path=/ and Secure on HTTPS. Database sessions expire after eight hours with refresh and cookie caching disabled. Every protected operation checks the signed session, current database expiry, active account, current role, memberships and campaign assignments. Removing access takes effect without waiting for a cached role to expire.

The library manages the session-token storage format; database/backup access is privileged. Application JSON login/session responses do not expose bearer tokens, and no account password hashes are returned by workspace APIs. Logout invalidates the database session. Password change verifies the old password, rotates the current session cookie and revokes other sessions. Password reset also revokes sessions. Deactivation and role changes revoke all sessions; deactivation leaves performance and audit history intact. The last active admin cannot be disabled or demoted through account management.

## Login throttling and input boundaries

A PostgreSQL upsert consumes each throttle attempt atomically across workers. Counters use HMAC identifiers, not plaintext emails. Login allows five attempts per email in 15 minutes, including successful attempts. Better Auth also applies a 60-per-minute sign-in rule per client bucket; the application applies a shared/client auth limit of 120 requests per minute. Invitation acceptance is limited to 20 per minute per bucket; reset requests are limited to three per email in 15 minutes. Limits are enabled in development and production, and fail closed if storage is unavailable.

`TRUSTED_CLIENT_IP_HEADER` can be `x-real-ip` or `cf-connecting-ip` **only** when a trusted reverse proxy overwrites it and the origin cannot be reached directly. With no configured header, application throttling uses a shared-origin bucket while retaining per-email limits. Do not trust client-supplied forwarded headers or allow direct origin access in that deployment mode.

Application mutation endpoints require an exact matching Origin, reject cross-site fetches, require JSON, cap bodies at 16 KiB and use strict Zod objects. Better Auth's origin/CSRF checks remain enabled. Login errors are generic. Inputs cannot supply an actor, role override, arbitrary source, import provenance or custom callback URL. Money uses explicit decimal strings and a supported currency code; calendar dates and nonnegative integer load counts are validated. API errors do not print bodies, cookies, reset URLs, tokens, hashes or connection strings.

## Password reset email

Without `RESEND_API_KEY` and `MAIL_FROM`, the recovery page says email is not connected and reset endpoints return 503. No success message or pretend email is produced. Normal invited-account login needs no external email-provider credential.

To connect resets, configure a Resend key securely, a verified sender in `MAIL_FROM`, and allow HTTPS egress to `api.resend.com`. Verify sender/domain and provider delivery in your deployment before announcing recovery availability. Never put the key in a public variable or repository. Resend requests use the server-side key; only active accounts are sent reset mail. Delivery is scheduled with Next.js `after` to avoid a provider round-trip revealing whether an email exists. The client shows only a generic conditional notice. Delivery failures are logged without token or address details. Reset links expire in 30 minutes. No live provider delivery was tested because credentials were not supplied.

Use the normal authenticated password-change form when you know your current password. An admin cannot view or choose another user's password. An emergency recovery workflow for a lost password with no email service remains an operator responsibility.

## Authorization and APIs

See `ARCHITECTURE.md` for the full role matrix. Workspace, lead and performance services use `authorized-operation.ts` for live authenticated reads/writes/exports; no page's hidden button is relied on for protection. `/api/workspace/:resource/:id` combines the ID with the caller's scope. A modified cross-team or unassigned-campaign ID returns 404; a role-forbidden operation returns 403; anonymous requests return 401.

Reads use a consistent transaction snapshot. Mutations re-read current identity and permissions in a serializable transaction, and write the audit event in the same transaction. Rolled-back database serialization conflicts are retried with fresh permissions, while stale record versions return 409 and require review. Writes use a bounded FIFO lane per process and reports keep parallel read access. There is no hard-delete API for users, teams, campaigns, leads or performance. Admins deactivate users/teams; staff correct or archive scoped performance records. Audit events have no application mutation endpoint.

Exports apply the same role and record scopes, select only permitted fields, neutralize CSV formula prefixes, are not cached, and legacy generic CSV exports cap at 1,000 rows. New performance and leaderboard CSV/XLSX exports use the same live scopes, include at most 5,000 rows and require narrower filters above that limit. Invitation credentials, auth accounts and throttle records are never exported. Admin Users are searchable/paginated at 20 via `/api/users`; other legacy resource lists are bounded to 50 records; Leads and performance have scoped 20-row pagination; approved reports aggregate the full permitted set and never combine currencies. Import previews, history, directories and report tables also use 20-row pages. Private batches require current scope and the uploader-role snapshot; downgrading staff to Dispatcher closes their old bulk previews. Run `npm run security:prune` in a daily operator job to remove expired sessions/verifications and throttle counters older than 24 hours; it also removes uncommitted import previews expired over seven days ago, while retaining committed batches, performance and audit history.

## Isolated functional checks

`npm test` runs permission and validation unit tests. `npm run test:smoke` performs real HTTPS/HTTP requests against a running local app and PostgreSQL. It requires a dedicated database name ending in `_test` and refuses an installation with existing users or business records. It creates its own private first-admin invitation with the actual bootstrap command when needed; all passwords are randomly generated. It removes the isolated test database's fixtures after the run. Never configure it for production.

For a local HTTPS check:

1. Create an empty test PostgreSQL database and set `TEST_DATABASE_URL` to it. Apply migrations using that URL as `DATABASE_URL`.
2. Supply a freshly generated `AUTH_SECRET`, `APP_URL=https://localhost:3443`, and start `npm start -- --hostname 127.0.0.1 --port 3001` with the test database (after `npm run build`).
3. Generate a local certificate with a localhost SAN into a private directory. Start `scripts/local-https-proxy.mjs` with `LOCAL_TLS_KEY` and `LOCAL_TLS_CERT` paths. This proxy is local-only and is not a deployment proxy.
4. Trust the locally generated certificate for Node via `NODE_EXTRA_CA_CERTS=/absolute/path/cert.pem`. Set `SMOKE_BASE_URL=https://localhost:3443` and run `npm run test:smoke`. No TLS verification is disabled.
5. Stop only your test processes and remove the disposable database/private test files when done. Live processes and local secrets must not be assumed to survive a cloud snapshot restoration.

Tests cover invitation replay, native-signup denial, secure cookies, unauthenticated reads/exports, cross-team and same-team-unassigned campaign IDs, forbidden roles/mutations, scoped CSV, account deactivation with preserved performance, live membership removal, password-change rotation, logout, expiration and parallel throttling. Browser layout checks are recorded separately in `VERIFICATION.md`.

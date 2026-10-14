# Consultations and private lead management

## Public submission

`/contact` submits JSON to `POST /api/consultations`. Contact name, company name, email, phone, offered equipment, integer fleet size (1–10,000), preferred contact method and message are required. The server normalizes contact fields, validates every field with a strict Zod schema, caps messages at 4,000 characters and the request body at 16 KiB, checks the exact configured origin and rejects a filled honeypot. Equipment choices come from the enabled items in `src/config/company.ts`; disabled/unoffered values cannot be submitted through modified requests.

Public pages render without credentials. Saving a consultation requires migrated PostgreSQL plus the existing `DATABASE_URL`, random `AUTH_SECRET` and exact `APP_URL` configuration. The auth secret also hashes anonymous throttle identifiers and submission fingerprints; it does not supply a public login or grant access to inquiries. No initial admin account is required to receive an inquiry, but an operator must bootstrap the real admin to review it.

Atomic PostgreSQL throttles enforce 12 requests per trusted client IP per 15 minutes and three submissions per normalized email per hour. With no isolated, explicitly trusted proxy header, all clients share a 60-request/15-minute fallback. Responses return 429 and `Retry-After` when limited. Deploy behind a reverse proxy that overwrites the configured single IP header; never trust browser-supplied IPs or arbitrary forwarded chains. The current email limit includes retries. Security pruning removes old counters without deleting business history.

A browser-generated random request UUID is unique in the database. Repeating an identical request reuses its saved inquiry; reusing the UUID with different details returns 409. Save and `CONSULTATION_RECEIVED` audit event commit in one transaction before success is returned. Network/server/validation/rate errors retain the form values in memory, and an unchanged retry reuses its UUID. The UI clears fields only when the user chooses to start another request. No contact data is placed in browser persistent storage.

The public response contains only `saved` and `notification`, without a lead ID, assignment, private notes or contact data. There is no public inquiry-read endpoint.

## Routing and permissions

New consultations start as **New** in an untriaged admin-only inbox with no fabricated team, campaign or dispatcher. Admins assign an actual active team, an optional campaign belonging to that team and an optional active dispatcher with matching membership/campaign assignment. Team-only leads do not require a dummy campaign.

| Role | Lead access |
| --- | --- |
| Admin | All inquiries; status, team/campaign/dispatcher assignment, follow-up and internal notes |
| Manager | Assigned active teams; campaign-specific leads also require direct campaign assignment. Manage status, permitted campaign/dispatcher assignment, follow-up and notes. Cannot move a lead to another team. |
| Dispatcher | Read personally assigned leads within current active teams and permitted campaigns. No lead mutations or note creation. |

All list, detail, count, option, note, mutation and export service calls verify a live session and current memberships inside a transaction. User-supplied filters are combined with that scope. A modified ID never replaces it. Membership/campaign removal clears affected lead assignments and audits each clearance. Account deactivation retains leads, notes and performance while removing active access.

Internal notes are separate `LeadNote` records with author/time. The legacy scalar `Lead.notes` is retained as a private existing summary. Both are visible only through authorized private reads; neither is used in a public response or notification email. Notes follow the lead when an administrator deliberately transfers it to another team. Non-admin audit reads are limited to that lead's current team events; global security/audit access remains admin-only. Audit metadata references note IDs without copying note text.

## Dashboard workflow

`/dashboard/leads` supports contact/company/email/phone search, status/source/team/campaign/dispatcher/assignment/follow-up/inbox filters and stable 20-row pagination with real total counts. Filters and exports retain server scope. `/dashboard/leads/[id]` shows the contact's message, internal notes and audit history and lets staff update the workflow.

Statuses: **New → Contacted → Qualified → Onboarding → Won / Lost**. Staff can correct a status in either direction; there is no invented qualification or mandatory sales outcome. Status and assignment changes record before/after values. Follow-up dates are UTC calendar dates, and due counts exclude Won/Lost. A version check rejects an outdated edit with 409 instead of overwriting another user's changes.

Overview and Leads counters use PostgreSQL `count` queries over the full authorized set, rather than counting a capped listing. CSV exports apply the same filters/scopes, neutralize spreadsheet formula prefixes and cap results at 1,000 rows. Appended note entries remain in details; an existing scalar internal summary may appear in the scoped legacy CSV. Neither CSV nor detail DTO exposes submission hashes or retry keys. Detail views show the latest 100 permitted notes/events and disclose this limit.

## Optional email alerts

Supply all of these securely to enable staff notifications:

```dotenv
RESEND_API_KEY=""
MAIL_FROM=""
INQUIRY_NOTIFICATION_EMAIL=""
```

Use a verified Resend sender and a real private notification recipient; no company contact or recipient is invented. Restart the application after configuration changes. Permit outbound HTTPS to `api.resend.com` in hosting/environment network settings. The same provider/sender can support password reset, which does not require the inquiry recipient.

Alerts contain only a link to the authenticated lead view, without the inquiry message, contact details or internal notes. Delivery has an eight-second timeout, a stable provider idempotency key and an atomic database claim. The save transaction finishes first. Email or notification-tracking failure cannot undo the inquiry or falsely report that it failed to save.

The public UI and private detail accurately distinguish **not configured**, **pending**, **provider accepted**, and **failed**. “Accepted” records the provider API response, not confirmed inbox delivery. A missing/rejected/interrupted provider never produces a pretend sent result. Failed alerts remain visible in lead details; there is no background automatic retry worker in this stage. Interrupted pending claims can be retried after a minute through an identical public-request retry, subject to abuse limits. Live provider delivery has not been verified without actual credentials.

## Migration and verification

`20261014130000_consultation_leads` preserves existing contacts, assignments and private summaries; backfills each old lead's team from its campaign; permits untriaged inquiries; adds indexes/constraints, retry keys, notification state, workflow versions and notes. Legacy **CLOSED** is migrated to **LOST** as a technical compatibility default because the old schema did not distinguish won/lost. This mapping is not evidence of an actual lost sale: review migrated records and correct their outcomes through the audited workflow before reporting them.

`bash scripts/verify-lead-migration.sh` tests preservation against an isolated temporary legacy database in the local development Docker container and deletes it afterward. `npm run test:smoke` includes the real HTTPS/PostgreSQL public-to-private journey, all statuses, protected notes, assignments, counts above 50 rows, filtered pagination/CSV, role/team boundaries and atomic abuse limits. It requires an empty `_test` database and a local app using that database; it never seeds a production installation. Unit tests cover strict public validation and independent save/email failures. See `VERIFICATION.md` for actual completed checks.

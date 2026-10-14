# Architecture

One Next.js App Router application and one shared PostgreSQL database. Public marketing rendering opens no database connection. Server-only modules own authentication and data access; no browser-supplied identity, role or team scope is trusted.

## Role policy

| Resource | Admin | Manager | Dispatcher |
| --- | --- | --- | --- |
| Users and invitations | Invite, view and update; deactivate without deleting history | No account administration | Own session/password only |
| Teams | Create, view, update and deactivate; manage memberships | View/update assigned teams; cannot alter membership or deactivate | View referenced assigned teams |
| Campaigns | Create, view, update and assign | Manage directly assigned campaigns within assigned teams; create only in assigned teams with self-assignment | View directly assigned campaigns within current teams |
| Leads | All; triage, assign and manage workflow/notes | Assigned teams; campaign-specific leads require campaign assignment; cannot move teams | View personally assigned leads in permitted active teams/campaigns; read-only |
| Daily performance | Create drafts, submit, approve, return, correct and archive with audit | Same workflow in assigned teams/campaigns | Own drafts editable/submittable; self-only history/reports; no approvals/corrections |
| Import previews/confirmation | Company batches; assigned producers | Own batches in assigned teams/campaigns | Own self-only batches/records; no bulk previews after staff downgrade |
| Settings and audit | Settings management; audit read/export only | No access | No access |
| CSV/XLSX exports | Permitted resources | Same scoped read boundary as list/detail | Own performance and assigned work only |

Manager performance scope requires an assigned reporting team. Legacy team-only history is readable within that team. New records require a campaign, and approval requires campaign/team context and current staff scope. Dispatcher historical performance remains self-only even after team reassignment. Performance stores a reporting-team snapshot so records do not silently follow a user to another team. Historical entries with no prior team are admin/owner-only.

## Boundaries

`src/lib/auth.ts` validates signed Better Auth sessions and reads live database identity. `src/lib/workspace.ts` and `src/lib/leads.ts` use `authorized-operation.ts` to independently authenticate every exported service function, builds role scopes, validates mutation inputs, resolves each supplied ID inside the scope, and persists changes/audit events in a transaction. Server pages call the same services as REST routes. Page redirects and navigation filtering are convenience only.

Manager campaign permissions require **both** team membership and direct campaign assignment. Work assignment requires an active dispatcher in the campaign team; lead assignment additionally requires campaign assignment. Removing a team membership removes related campaign assignments and clears lead ownership, while keeping performance history. No role-specific route can bypass these boundaries with a modified record, user, team or campaign ID.

Read transactions provide a consistent snapshot; serializable mutations keep permission reads and related writes in a consistent serialized operation. Rolled-back database serialization/deadlock conflicts receive bounded retries with fresh permissions; changed record versions remain 409. A bounded FIFO write lane per process reduces contention and keeps report reads independent. Foreign keys preserve record relationships and database checks reject negative metrics. Unique dispatcher/date keys prevent duplicate daily aggregates. Audit events are append-only through the application; database operators still need privileged access controls and backup/retention policy.

## Models

- Better Auth core: `User`, `Account`, `Session`, `Verification`.
- Identity scopes: `Team`, `Membership`, `Campaign`, `CampaignAssignment`.
- Work: `Lead`, `LeadNote`, `PerformanceEntry`, `ImportBatch` provenance foundation.
- Security/operations: `Invitation`, `InvitationTeam`, `AuditEvent`, `RateLimit`, `Setting`.

Auth cookies are signed, host-only, HttpOnly, Secure in production and SameSite=Lax. Sessions expire after eight hours without refresh/cache. Only admins invite users; the first admin is bootstrapped using a private, expiring invitation file. Signup/profile/deletion endpoints are excluded from the auth HTTP allowlist.

No production fixture or automatic seed is supplied. Integration fixtures require a dedicated `_test` database and do not populate the production development database. The Prisma pool is capped at 10 connections per application process; deployments must size total pools against PostgreSQL limits. Users, Leads and performance lists use 20-row pagination; Admin account/membership choices include all permitted users; approved performance aggregates include the full scoped set. A local concurrent 60-dispatcher workflow is verified, while production load/scale depends on deployment. CSV/XLSX previews, mapping, audited transactional confirmation, safe batch retries and filtered report exports are delivered; see [Imports/exports](IMPORTS_EXPORTS.md). Report tables are paginated, while full scoped aggregates and rankings remain independent of UI pages.

Public consultation submission is the explicit anonymous write boundary. It accepts contact fields only, sets all internal routing/status fields on the server, commits before reporting success, and isolates optional email delivery. See [Leads](LEADS.md) for routing, privacy, counters, filtering, pagination and abuse limits.

Approved performance uses exact decimal fees, separate freight revenue and one explicit currency per report. Campaign-local date boundaries and stable team/timezone snapshots govern filtering. The daily unique key is dispatcher/campaign/date. See [Performance](PERFORMANCE.md) for state transitions, authorized corrections, ranking/ties and concurrency scope.

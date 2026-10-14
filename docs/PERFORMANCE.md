# Campaign performance and approval

## Daily record contract

Each manual record has a work date, campaign and dispatcher; calls made, follow-ups completed, qualified leads and carriers signed; loads booked when relevant; dispatch fees earned, refunds, signed adjustments, optional gross freight revenue, explicit currency and private notes.

One record is allowed per **dispatcher + campaign + work date**, regardless of currency or approval/archive state. The PostgreSQL unique index also protects legacy null-campaign records. Multiple shifts must be combined into this daily aggregate; this stage does not accept separate shift records. A future shift feature must introduce an explicit shift identity and reviewed uniqueness policy before enabling multiple entries.

New records start as Draft. Counts are nonnegative integers; money arrives as decimal strings with at most two places and is stored as PostgreSQL `DECIMAL(18,2)`. Refunds and earned fees are nonnegative; adjustments may be positive or negative. Net dispatch fees = **earned fees − refunds + adjustments**, and can be negative. All financial fields in one record use its explicit three-letter currency. No exchange-rate conversion or mixed-currency total exists. Optional gross freight revenue remains a separate field and is never used as dispatch earnings or a ranking tie-breaker. Missing freight revenue remains null.

Record creation derives the reporting team and timezone from the authorized campaign. An optional supplied team ID must match; role, approval, source and timezone overrides from clients are rejected. The dispatcher must be active, a member of the campaign team and assigned to the campaign. Dispatcher identity is self-only; staff can create for an eligible dispatcher in their scope.

## Review workflow

| Action | Permission and behavior |
| --- | --- |
| Save/create draft | Owner Dispatcher or scoped Manager/Admin. Draft work date, campaign, currency, dispatcher (staff only) and metrics may be corrected; duplicates and assignments are rechecked. |
| Submit | Owner or scoped staff; Draft → Submitted. A future work date in the campaign timezone cannot represent completed work. |
| Approve | Scoped Manager/Admin only; Submitted → Approved. Records need campaign/team context. Only active approved records affect official totals. |
| Return to draft | Scoped Manager/Admin, Submitted only, required reason. Owner can edit and resubmit; history remains. |
| Correct approved record | Scoped Manager/Admin with required reason and current version. Metrics/notes change atomically, approval reviewer/time are updated and complete before/after evidence is audited. Identity, date, campaign and currency stay fixed. |
| Archive/restore | Scoped Manager/Admin with required reason. Archived records remain in history and occupy their daily unique key; they are excluded from official totals until restored. |

Submitted records cannot be edited directly and dispatchers cannot approve or correct approved records. Version checks reject stale commands with 409. A correction replaces the canonical record's values once instead of creating another counted record. Drafts and unapproved submissions never enter rankings/charts.

Every service read, option list, mutation, count and export verifies a signed session and current database identity. Mutations recheck scope and related IDs inside a serializable transaction and commit their audit event with the record. Reads use a consistent snapshot. Short protected writes share one FIFO lane per application process, bounded to 500 waiting commands and 30 seconds of queue wait; overload returns a recoverable 503 while forms retain values. Read reports remain parallel. Transactions have a bounded ten-second acquisition wait and ten-second execution timeout; database pools remain bounded to ten connections per application process. Only rolled-back database serialization/deadlock conflicts are retried, up to five retries with jitter and fresh permission checks. PostgreSQL serializable protection still applies across processes and to anonymous inquiry writes. A changed record version remains a 409; the application never overwrites a newer user command automatically. Exhausted conflicts are reported as recoverable 409 responses.

Managers can access only their current assigned reporting teams and directly assigned campaigns; legacy team-only records can be reviewed within that team but cannot enter official totals without campaign context. Dispatchers retain self-only historical read/report access even after campaign/team removal, while draft changes/submission still need current campaign assignment. Deactivation prevents login and retains records, approvals and audits.

## Campaign dates and loads

Configure an IANA timezone in Campaign management, for example `America/New_York`, `Asia/Karachi` or `UTC`. Existing campaigns use explicit UTC compatibility configuration. The work-date field is a **campaign-local calendar date**, stored as PostgreSQL DATE; it is not a timestamp converted from browser timezone. A timezone snapshot is stored on each record. Once any record exists, a campaign's timezone is locked to prevent reinterpreting history; create a distinct campaign for a different timezone. Campaign load relevance is configurable for future records and snapshotted on creation. Irrelevant loads are null rather than a claimed zero.

Reports offer daily, weekly and monthly periods. Weeks run Monday–Sunday and months follow the calendar. With no anchor date, each campaign uses the current date in its configured timezone. A supplied anchor selects the period containing that local calendar date. Inclusive per-campaign bounds are displayed in the UI, including all-campaign views. Different timezones can place campaigns in different current days or months; trends explicitly combine campaign-local date buckets. Calendar arithmetic preserves leap months and DST work dates without assuming every work day is 24 hours.

## Official reports and ranking

`/dashboard` shows approved weekly USD cards/trends with an explicit currency label and a link to full filters. `/dashboard/reports` supports period, optional anchor, campaign, team and currency. A single required currency filter applies to every metric and financial sum; comparison of USD and CAD is done in separate views. Reporting includes all permitted approved records, independent of the 20-row daily-record pagination.

PostgreSQL groups approved, unarchived, scoped records by dispatcher, reporting-team snapshot and work date. Decimal sums are converted to strings; final monetary reduction, net calculations, formatting and ranking use integer cents (`BigInt`) instead of floating-point arithmetic. SVG coordinates use relative numeric scaling for display only, while exact values remain in labels and the accessible trend table. No chart or ranking uses fixtures or a capped latest-record list.

The leaderboard sorts **approved carriers signed descending**, then **net dispatch fees descending in the selected currency**. Exact ties share a competition rank (1, 1, 3). Stable IDs order tied rows for display without awarding a different rank. Manager rankings represent their assigned scope, and Dispatcher reports/positions represent only their own approved records. Inactive producers remain in historical rankings, identified honestly as inactive.

Conversion rate = **approved carriers signed ÷ approved qualified leads × 100** in the selected scope/currency/period. A zero denominator displays N/A, not Infinity or an invented 0%. This is an activity ratio, not a unique-lead cohort conversion: it may exceed 100% when signings relate to earlier qualification activity. Manual counts do not prove unique individual leads or carriers. Monetary cards, carrier/fee trends, team comparisons and leaderboards show useful empty states without approved data.

## Routes, history and exports

- `/dashboard/performance`: scoped filters and 20-row pagination, draft entry and record links.
- `/dashboard/performance/[id]`: work details, saved draft editing, submission/review/correction controls and latest 100 scoped audit events, including visible before/after evidence for staff.
- `GET/POST /api/performance`: guarded list/create.
- `GET/PATCH /api/performance/[id]`: guarded detail/workflow command.
- `GET /api/performance/report`: guarded approved aggregate; explicit currency required.
- Existing `/api/workspace/performance` routes delegate to the same workflow rather than bypassing approval.
- Filtered CSV/XLSX record exports at `/api/performance/export` and approved rankings at `/api/performance/report/export` apply the same live scopes; see `IMPORTS_EXPORTS.md` for filters, limits and formula protection.
- Legacy scoped CSV export at `/api/workspace/performance/export` accepts record filters, includes explicit state/currency and caps rows at 1,000. It never combines money, and neutralizes spreadsheet formula prefixes.

The migration preserves every existing freight-revenue decimal, currency, identity and reporting-team context. Old records become Submitted with no fabricated approval and zero newly introduced activity/fee fields awaiting human review. An unassigned legacy record must be returned to draft and attached to a permitted campaign before submission/approval. No production seed is provided.

## Verification and deployment

`npm test` includes exact cents/refund/adjustment/tie/conversion and local-calendar boundary tests. `npm run test:smoke` runs the full real HTTPS/PostgreSQL auth, lead and performance journey against an empty dedicated `_test` database. It exercises 60 isolated dispatchers through real creation, submission and approval endpoints, plus concurrent reports; fixture users are removed afterward. See `VERIFICATION.md` and `/workspace/scratch/northlane-performance/load-results.json` for measured completed results. This local check does not establish production capacity on different hardware, database pools or hosting.

`bash scripts/verify-performance-migration.sh` creates and deletes a disposable legacy database in the local development container to check preservation, approval evidence and campaign uniqueness. Production requires the existing secure database/auth/HTTPS configuration and operator bootstrap; this stage needs no new external provider credential. CSV/XLSX import and filtered performance/leaderboard exports are delivered; see [Import/export rules](IMPORTS_EXPORTS.md). Imported records start Draft and retain batch/row/uploader provenance.

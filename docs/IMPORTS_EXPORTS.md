# CSV/XLSX performance import and report export

## Formats and limits

`/dashboard/imports` provides authenticated CSV and XLSX templates, a paginated assigned-dispatcher directory and private import history. A file belongs to **one selected campaign**. The optional `campaign_id` cell must match that selection; split multi-campaign files into separate batches.

Uploads support UTF-8 `.csv` and unencrypted `.xlsx`, up to **2 MiB**, **1,000 data rows** and **32 columns**. The request stream is bounded before multipart parsing, even if Content-Length is absent or false. XLSX ZIP archives have at most 100 entries and 8 MiB of declared expanded content; unsupported archive paths, macros, embedded objects, external workbook links and DTD/entity declarations are rejected. Worksheet addresses must be unique and within A1:AF1001. Stale worksheet dimensions are not trusted.

XLSX uses the **Performance** worksheet when present, otherwise its sole worksheet. Other worksheets are ignored deliberately; the downloadable workbook includes an Instructions worksheet. Headers start in A1 and must be literal, nonempty and unique. CSV commas, quoted commas, escaped quotes, UTF-8 BOM and quoted multiline text are supported; malformed quoting fails the upload. Source row numbers refer to CSV records (including blank records) or actual XLSX worksheet rows, rather than physical newline counts inside quoted cells. Blank rows are omitted from preview, but still occupy the file's row/address limit.

Files are parsed with maintained `csv-parse` 7.0.3 and `read-excel-file` 9.3.12. The latter's documented `parseNumber: value => value` preserves the original decimal string instead of converting money to a floating-point Number. Properly formatted Excel date cells and literal ISO dates are accepted; time-of-day values are rejected. Scientific notation, grouping commas, currency symbols and percentages are not accepted as numeric performance values. Use literal plain decimals. Actual XLSX formula/error cells receive row errors even if a cached result exists; no formula is evaluated. A formula-looking **string** in a notes cell is treated as private literal text and is neutralized on export.

Each authenticated user has a persistent upload limit of 20 attempts per ten minutes. Hosts/reverse proxies should also bound request size and upload duration; the application cannot configure external infrastructure.

## Template columns

| Column | Contract |
| --- | --- |
| `work_date` | Required `YYYY-MM-DD` campaign-local calendar date; invalid dates and year zero are rejected. A valid Excel date cell is also accepted. Future dates can be drafted, but submission follows the existing future-work rejection. |
| `campaign_id` | Optional value; must equal the selected campaign when supplied. |
| `dispatcher_id` | Stable ID of an active assigned Dispatcher in the selected campaign/team. Supply this or a verified email. |
| `dispatcher_email` | Account email with `User.emailVerified = true`, case-insensitive. If both ID and email are provided, they must identify the same user. An invitation alone does not make an unverified account email acceptable; use its stable ID. |
| `calls_made` | Required integer, 0–1,000,000. |
| `follow_ups_completed` | Required integer, 0–1,000,000. |
| `qualified_leads` | Required integer, 0–1,000,000. |
| `carriers_signed` | Required integer, 0–1,000,000. |
| `loads_booked` | Required integer when the campaign tracks loads; otherwise blank/null. |
| `dispatch_fees` | Required nonnegative plain decimal, at most 12 whole digits and two fractional digits. |
| `refunds` | Same nonnegative money contract; enter `0` when none. |
| `adjustments` | Required signed plain decimal; enter `0` when none. |
| `currency` | Required supported three-letter currency. Every amount within the row uses that currency. |
| `gross_freight_revenue` | Optional nonnegative money; blank remains null. Never added to dispatch fees or used in fee ranking. |
| `notes` | Optional private literal text, at most 2,000 characters. |

Names alone never identify users or campaigns. The directory exposes only active assigned IDs/names within the caller's scope; emails are displayed only when verified. It uses 20-row pagination. Templates contain headers and instructions, with no fabricated dispatcher, money or business activity.

## Preview and confirmation

1. Select an assigned active campaign and upload a file. A new **STAGED** batch saves private row cells, inferred mapping, validation results, creator/time, uploader-role snapshot and campaign validation context. No daily performance record is created at upload.
2. Review the 20-row preview pages and error-only filter. Expand column mapping to map arbitrary headers; required mappings, repeated source-column mappings and out-of-range columns are checked. Applying mapping validates all rows and increments the batch version.
3. Resolve malformed/unauthorized rows in the file or mapping. Duplicate daily keys inside the file exclude **every occurrence**, including ID/email aliases for the same dispatcher. Existing database records exclude matching rows regardless of currency, state or archive status. No record is overwritten.
4. Explicitly acknowledge the valid and excluded counts and confirm. Only the server-stored valid rows are candidates; clients cannot supply replacements, actors, roles, source or approvals to the confirmation endpoint. Invalid rows are skipped only with that acknowledgement.
5. Confirmation rechecks the signed session, live user/role, team/campaign permissions, active dispatcher assignments, loads/timezone configuration, values and database duplicates in the write transaction. If validation or campaign context changed since preview, no records are saved: refreshed results/version are persisted and a 409 asks for a new review and confirmation.
6. All currently confirmed valid records, per-record audits and batch completion commit in **one serializable transaction**. A database failure rolls back every new record/audit in that commit; it does not leave a partly imported batch. The daily unique key remains the last defence against another writer. There is no skipDuplicates write path.

Imported records start **DRAFT**, with `source = IMPORT`, the batch ID and a unique original-row link. They retain explicit currency, decimal amounts, reporting-team/timezone/load-relevance snapshots and the confirming actor as `submittedById`. Existing owner draft editing, submission, Manager/Admin approval, return and reasoned approved correction apply unchanged. Imported drafts/submissions do not affect official charts or totals. Record details show filename, original row, uploader, committed timestamp and batch ID; audit records also identify the actual confirming actor. Upload creator and confirmer can differ when an Admin assists.

The same upload request UUID with different file bytes/campaign/actor is rejected. Identical file bytes for the same uploader/campaign return the existing batch even with a new filename or request UUID. A retry of a committed confirmation returns that batch's existing saved outcome, without creating records. A differently encoded CSV/XLSX with the same daily keys is detected against the database during preview rather than treated as a byte-identical upload. Whitespace/content changes do not bypass daily-record uniqueness.

Previews expire after 24 hours. Expired previews cannot be committed; a fresh upload request can replace an expired, uncommitted batch. `npm run security:prune` removes only uncommitted previews expired for over seven days, alongside existing security cleanup; it retains committed batches, performance and audit history. Original source files are never retained on disk or served back to users.

## Access boundaries

- Admin can inspect/confirm company batches and import any active assigned Dispatcher in an active campaign.
- Manager can upload only within current assigned teams **and directly assigned campaigns**, and inspect/confirm only their own batches in that scope. Once committed, performance records are visible to other authorized reviewers through the normal performance section.
- Dispatcher can upload only their own currently assigned work and inspect their own self-only batches. Other producers in their file get row errors. A self-only batch stays limited to its original dispatcher even when an Admin remaps/confirms it.

The uploader-role snapshot prevents a former Manager/Admin, now a Dispatcher, from opening/replaying an old bulk preview containing others' work. Authentication and current scope are enforced on reads, mappings, confirmation, directory, templates and every export. Raw rows/errors/notes are private; they never enter public routes or notifications. A hidden navigation link is not an access control. Legacy pre-preview imports retain original provenance/state; their unavailable previews and unknown historical uploader roles are reported honestly and are Admin-only.

## Filtered exports and pagination

`/dashboard/performance` offers filtered CSV/XLSX record exports. Record filters are campaign, reporting team, dispatcher, batch ID, currency, state, work-date range and active/all archive history; a UI page number never truncates an export. Exports include the documented daily columns plus record ID/name/context, state, exact net fees, timezone, archive/source, batch/row/importer/time and version. Unnecessary account emails are omitted; stable dispatcher IDs remain. Each row carries its currency; no mixed-currency total is calculated.

`/dashboard/reports` offers daily/weekly/monthly filtered leaderboard CSV/XLSX exports using the **same approved-report service** as the dashboard. The selected currency is mandatory at the API boundary. Campaign/team/dispatcher/date-period filters, actual competition ranks, exact net fees and the campaign-local bounds are included. Drafts, submissions and archived records are excluded. Gross freight revenue remains separate. CSV uses N/A for a zero conversion denominator; the activity-ratio/ranking definitions remain those in `PERFORMANCE.md`. XLSX includes a scope/instructions worksheet.

Exports include every matched permitted row up to **5,000**. A larger result returns 422 with instructions to narrow filters, instead of silently truncating. Empty exports retain their headers. Spreadsheet formula prefixes (including leading whitespace, tab, carriage return, `=`, `+`, `-`, `@`) are apostrophe-prefixed; quoting is escaped and unsafe XML controls removed. XLSX cells are explicitly literal strings and never formula types. Money is emitted as exact decimal text. Protected CSV text may include a safety apostrophe, so report exports are not an automatic round-trip import format; use the templates for entry. Responses are private/no-store and downloads have fixed safe filenames.

Record lists, import history, row previews, identifier directories, leaderboard and team comparison tables use 20-row pages. Cards, charts, ranks and filtered exports still use the full authorized data, independent of displayed pages.

## API and validation commands

- `GET/POST /api/performance/imports`: scoped history / bounded multipart upload (`file`, `campaignId`, `requestKey`).
- `GET /api/performance/imports/[id]`: paginated preview/results (`page`, `rows=all|valid|errors`).
- `POST /api/performance/imports/[id]/preview`: `{ version, mapping }`.
- `POST /api/performance/imports/[id]/confirm`: `{ version, confirm: true }`.
- `GET /api/performance/imports/template?format=csv|xlsx`: authenticated templates.
- `GET /api/performance/imports/directory?campaignId=...&page=...`: scoped identifiers.
- `GET /api/performance/export?...&format=csv|xlsx`: filtered records.
- `GET /api/performance/report/export?...&currency=USD&format=csv|xlsx`: filtered approved leaderboard.

`npm test` covers parser/format bounds, exact decimals, malformed cells/dates/mappings, formula/error cells, ZIP/XML controls and safe output. `npm run test:smoke` adds real HTTPS/PostgreSQL import/export checks to the existing auth/lead/performance suite and requires an **empty dedicated `_test` database**. It includes 60 producers, a 1,000-row batch, concurrent confirmations, a forced database rollback, role downgrade and assignment-removal checks, plus both export formats and a 5,001-record overflow. All fixtures are removed. `bash scripts/verify-import-migration.sh` creates/deletes a disposable legacy-schema database and checks original decimal/provenance preservation. See `VERIFICATION.md` for completed results.

No new external credentials are required for imports/exports. Production HTTPS/database/auth configuration, first real Admin, backups and hosting capacity remain operator launch work.

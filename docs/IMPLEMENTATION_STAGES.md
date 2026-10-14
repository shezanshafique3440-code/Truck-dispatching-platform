# Implementation stages

## 1. Foundation — delivered

Establish the requested stack, responsive navy/white/orange public design, reusable components, central company configuration, environment example and shared database model. Keep the private workspace closed until trusted authentication exists. Validate build, lint, types, schema, authorization policy and anonymous routing. Database migration validation is reported separately from the public application checks.

## 1B. Premium public website — delivered

Build Home, Services, How It Works, About and Contact with responsive navigation, footer and discreet Team Login access. Include proposed editable service/equipment content, the requested hero headline, real consultation route links, and an explicitly identified local concept truck image. Keep company claims unset. At this stage contact submission was deferred; the connected form was delivered in stage 2B below. Verify desktop/mobile layouts, keyboard navigation, link destinations and accessibility before completing this stage.

## 2. Database, authentication and secure dashboard — delivered

Better Auth provides invitation-only accounts, signed database sessions, logout and password change. Persistent atomic throttling, server validation and CSRF/origin checks are enabled. Users, teams, memberships, campaigns/assignments, leads, daily records, invitations, audit and settings are modeled. Each read, mutation and export independently enforces live roles and assignments. Deactivation preserves history. A private first-admin invitation command replaces default credentials. The dashboard has management forms and role-appropriate empty states. Basic daily submissions and audited corrections are included to fulfill dispatcher permissions; the next stage expands that experience.

Real HTTPS/database tests cover anonymous access, modified IDs, role boundaries, scoped exports, invitation replay/expiry/revocation, cookie security, deactivation, role changes, membership removal, session rotation/logout/expiry and concurrent throttling. Password reset email remains honestly unavailable without a configured provider; no live delivery has been tested. Production database/auth values and the first actual administrator must be configured by the operator. See `AUTHENTICATION.md` and `VERIFICATION.md`.

## 2B. Public consultations and private lead management — delivered

Connect the consultation form to PostgreSQL with strict server validation, atomic abuse limits, safe interrupted-request retries and truthful save/email outcomes. Provide an admin-only untriaged inbox, scoped team/campaign/dispatcher assignment, searchable/filterable paginated leads, contact details, private authored notes, UTC follow-up dates and real database counters. New, Contacted, Qualified, Onboarding, Won and Lost statuses and assignment changes have transactional audit history. Verify the complete public-to-private journey and role/team/export boundaries. Optional Resend alerts require a verified sender, key and private recipient; production delivery remains unverified without credentials. See `LEADS.md` and `VERIFICATION.md`.

## 3. Campaign performance and approved reporting — delivered

Manual daily drafts record calls, follow-ups, qualified leads, carriers signed, relevant loads, dispatch fees, refunds/adjustments, optional separate freight revenue, currency and notes. Dispatcher/campaign/date uniqueness, immutable timezone/team snapshots, submission, Manager/Admin approval and authorized before/after corrections protect official totals. Dashboard cards, real approved trends, team comparisons and scoped daily/weekly/monthly competition rankings use one currency and explicit conversion/date rules. Owner drafts are editable, Submitted records are locked pending review, and Approved corrections require a reason/version. Serial writes and bounded conflict retries preserve live permissions under a local 60-dispatcher burst. See `PERFORMANCE.md` and `VERIFICATION.md`.

## 4. CSV/XLSX import and filtered report export — delivered

Download documented templates, identify assigned dispatchers by stable ID or verified email, and stage bounded files in private paginated previews. Column mapping and row validation cover literal dates/money/counts, campaign/team/role scope, loads relevance and in-file/database duplicates. Explicit confirmation creates only valid drafts in one audited transaction with unique batch/row provenance. Upload/confirmation retries are idempotent and never overwrite records or auto-approve activity. Role snapshots prevent downgraded staff from reading earlier bulk previews. Filtered performance and approved leaderboard CSV/XLSX exports use current live scope and spreadsheet formula protection, independent of 20-row UI pagination. See `IMPORTS_EXPORTS.md` and `VERIFICATION.md`.

## 5. Extended reporting and production capacity

Campaign aggregate metrics, date/currency filters, accessible trends, team comparisons and full scoped leaderboards are delivered in stage 3. Filtered record and leaderboard CSV/XLSX exports and report table pagination are delivered in stage 4. Extend custom report date ranges and deeper analysis as required. Measure production query plans and deployment pool budgets, then test realistic sustained production concurrency before claiming capacity on that infrastructure.

## 6. Launch hardening

Populate only approved brand/contact/business facts. Finalize public content and any lead handling, privacy terms and spam protection. Verify authentication, audit retention, backup/restore, error monitoring, secure deployment and end-to-end role isolation. Conduct keyboard/mobile checks, security review and performance validation. Publish only after reviewing credentials and deployment configuration.

## 6A. Complete application review — delivered

Review public/account/private screens across phone, tablet and desktop; standardize responsive typography, focus, reduced motion, form feedback, loading and safe error states. Add configured public canonicals/social metadata, a public-only sitemap, robots exclusions and distinct private noindex titles. Remove the 50-account management cap with searchable user pages and complete selectors. Verify the joined inquiry → assignment → daily submission → staff approval → leaderboard journey, approval/tie/date/import boundaries, and production build. Launch hosting/domain/credentials, external email, backups and monitoring remain operator work. See `APPLICATION_REVIEW.md` and `VERIFICATION.md`.

## 6B. Ubuntu VPS deployment preparation — delivered

Prepare non-root standalone app and separate operator images, isolated production Compose services, private PostgreSQL authentication/persistent storage, readiness/restart controls, secret-free configuration examples, guarded backup/new-database restore helpers and separate new-domain proxy templates. Document explicit migrations, real Admin bootstrap, email, updates and schema-aware rollback. Verify locally; no existing server/proxy or external deployment is modified. Approved release/VPS/domain/TLS/secrets, off-server backups and monitoring remain operator work. See `DEPLOYMENT.md`, `DEPLOYMENT_CHECKLIST.md` and actual results in `VERIFICATION.md`.

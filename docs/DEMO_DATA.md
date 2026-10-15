# Local DEMO workspace

This explicit local development command adds synthetic data to PostgreSQL:

```sh
bash scripts/dev-database.sh
npm run db:generate
npm run db:deploy
NODE_ENV=development npm run db:seed:demo -- --confirm-local-demo
npm run dev
```

Use the existing ignored `.env` with a loopback `DATABASE_URL` pointing to `dispatch_development`, `*_demo`, or `*_test`. The seed refuses other database names, remote hosts, missing confirmation, and every `NODE_ENV` except `development`. Do not forward a production database through loopback or give a production database a development name. Do not run this command in production. It is never part of install, build, migrations or application startup.

The first run inserts 64 dispatchers, four review managers, four teams, eight campaigns, 192 leads and 3,840 daily performance records spanning 60 consecutive UTC calendar dates ending on the first run's date. Activity varies by dispatcher, day and weekend, with draft/submitted/approved states, four campaign timezones, USD fees, occasional refunds and adjustments. All names and performance notes carry **DEMO** labels. These figures are synthetic, not actual company results. Contact addresses use reserved `.invalid` domains. No emails are sent.

The data remains in PostgreSQL across app restarts. The existing database helper reuses its container; do not remove the container to preserve local data. A transaction and advisory lock make the seed atomic and serialize concurrent runs. Fixed versioned IDs and a manifest in `Setting` make subsequent runs a no-op, preserving the original date window and any edits made afterwards. There is deliberately no destructive reset command. If the manifest is absent but reserved IDs exist, the seed refuses rather than adopting or changing those rows. Use a separate fresh local database for another original fixture set.

Existing Admins, users, passwords, sessions, invitations, memberships, records and settings are not updated or deleted. No default passwords, accounts, sessions, invitations or new Admin are created. Demo users cannot sign in because they have no authentication accounts; use an existing authorized Admin to inspect the data. On a fresh installation follow `docs/AUTHENTICATION.md` to create an Admin through the normal private invitation process. No authentication or authorization checks are bypassed. Managers and dispatchers retain their normal team/campaign scope. Dashboard overview labels synthetic data when its visible campaigns contain DEMO names; individual entities and notes retain their labels in lists/details/exports. Public pages contain no demo counts or claimed customer results.

## Repeatability and preservation test

```sh
npm run test:demo
```

Requires local PostgreSQL with permission to create a temporary database. This creates a uniquely named empty `_test` database, applies the committed SQL migrations in order, inserts existing-record sentinels, checks production refusal, exact fixture counts and 60 dates, repeat-run immutability, collision refusal, and preservation of sentinels. It also verifies the seed creates no authentication accounts or sessions. It drops only the database created by that invocation. This fixture test does not replace Prisma migration validation or the existing HTTP permission/authentication smoke suite.

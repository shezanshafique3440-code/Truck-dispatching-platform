import "dotenv/config";
import { Client } from "pg";

// Explicit opt-in only. This file is never imported by app startup or migrations.
const target = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
if (process.env.NODE_ENV !== "development" || !process.argv.includes("--confirm-local-demo") ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    !/^(dispatch_development|[a-z0-9_]+_(demo|test))$/.test(target.pathname.slice(1))) {
  throw new Error("DEMO seed requires NODE_ENV=development, --confirm-local-demo and a loopback dispatch_development / *_demo / *_test database.");
}
const db = new Client({ connectionString: target.href });
const prefix = "northlane_demo_v1_";
const marker = `${prefix}manifest`;
const id = (kind: string, n: number) => `${prefix}${kind}_${n}`;
async function insert(table: string, data: Record<string, unknown>) {
  const columns = Object.keys(data);
  // Identifiers below are fixed internal schema names, never CLI input.
  await db.query(`INSERT INTO "${table}" (${columns.map(k => `"${k}"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(data));
}
// Only Prisma's schema hint is accepted; query options cannot redirect PostgreSQL.
if ([...target.searchParams.keys()].some(key => key !== "schema")) {
  throw new Error("DEMO seed refuses connection query options other than schema.");
}
await db.connect();
try {
  await db.query("BEGIN");
  await db.query("SELECT pg_advisory_xact_lock(741650221)");
  const existing = await db.query('SELECT value FROM "Setting" WHERE key=$1', [marker]);
  if (existing.rowCount) {
    console.log("DEMO v1 already installed; no records changed. Original 60-day window is preserved.");
  } else {
    // Refuse collisions; never adopt, update or delete existing data.
    for (const table of ["User", "Team", "Campaign", "Lead", "PerformanceEntry"]) {
      const collision = await db.query(`SELECT 1 FROM "${table}" WHERE starts_with(id, $1) LIMIT 1`, [prefix]);
      if (collision.rowCount) throw new Error(`DEMO namespace collision in ${table}; transaction rolled back.`);
    }
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const names = ["Avery", "Jordan", "Morgan", "Taylor", "Casey", "Riley", "Cameron", "Quinn"];
    for (let t = 0; t < 4; t++) {
      await insert("Team", { id: id("team", t), name: `DEMO · ${["Atlantic", "Central", "Mountain", "Pacific"][t]} desk`, active: true, updatedAt: now });
      await insert("User", { id: id("manager", t), name: `DEMO · Review manager ${t + 1}`, email: `demo-manager-${t}@northlane.example.invalid`, role: "MANAGER", active: true, updatedAt: now });
      await insert("Membership", { userId: id("manager", t), teamId: id("team", t) });
      for (let c = 0; c < 2; c++) {
        const ci = t * 2 + c;
        await insert("Campaign", { id: id("campaign", ci), name: `DEMO · ${["Dry van", "Reefer"][c]} / ${t + 1}`, description: "DEMO — synthetic local development campaign. Not actual company activity.", teamId: id("team", t), status: "ACTIVE", timezone: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"][t], tracksLoads: true, updatedAt: now });
        await insert("CampaignAssignment", { campaignId: id("campaign", ci), userId: id("manager", t) });
      }
    }
    for (let u = 0; u < 64; u++) {
      const team = Math.floor(u / 16); const campaign = team * 2 + u % 2;
      await insert("User", { id: id("dispatcher", u), name: `DEMO · ${names[u % 8]} ${String(u + 1).padStart(2, "0")}`, email: `demo-dispatcher-${u}@northlane.example.invalid`, role: "DISPATCHER", active: true, updatedAt: now });
      await insert("Membership", { userId: id("dispatcher", u), teamId: id("team", team) });
      await insert("CampaignAssignment", { userId: id("dispatcher", u), campaignId: id("campaign", campaign) });
      for (let l = 0; l < 3; l++) {
        await insert("Lead", { id: id("lead", u * 3 + l), name: `DEMO · Carrier contact ${u * 3 + l + 1}`, email: `demo-carrier-${u}-${l}@example.invalid`, companyName: `DEMO · Fleet ${u * 3 + l + 1}`, equipmentType: u % 2 ? "Reefer" : "Dry Van", fleetSize: 1 + (u + l) % 12, source: "MANUAL", status: ["NEW", "CONTACTED", "QUALIFIED", "ONBOARDING", "WON", "LOST"][(u + l) % 6], notes: "DEMO — synthetic contact; do not contact. No real carrier or commercial claim.", teamId: id("team", team), campaignId: id("campaign", campaign), assignedToId: id("dispatcher", u), followUpDate: new Date(today.getTime() + ((u + l) % 9 - 4) * 86400000), updatedAt: now });
      }
      for (let day = 0; day < 60; day++) {
        const date = new Date(today.getTime() - (59 - day) * 86400000);
        const weekend = [0, 6].includes(date.getUTCDay());
        const activity = (u * 17 + day * 13) % 37;
        const calls = weekend ? 12 + activity : 48 + activity;
        const qualified = Math.floor(calls / 9); const carriers = (u + day) % 4 === 0 ? Math.min(2, qualified) : 0;
        const loads = weekend ? (u + day) % 2 : 1 + (u + day) % 5;
        const state = day < 58 ? "APPROVED" : day === 58 ? (u % 4 === 0 ? "SUBMITTED" : "APPROVED") : u % 3 === 0 ? "DRAFT" : u % 3 === 1 ? "SUBMITTED" : "APPROVED";
        const submittedAt = new Date(Math.min(date.getTime() + 20 * 3600000, now.getTime() - 2 * 3600000));
        await insert("PerformanceEntry", { id: id("performance", u * 60 + day), dispatcherId: id("dispatcher", u), submittedById: id("dispatcher", u), teamId: id("team", team), campaignId: id("campaign", campaign), date, workTimezone: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"][team], callsMade: calls, followUpsCompleted: Math.floor(calls / 4), qualifiedLeads: qualified, carriersSigned: carriers, loadsRelevant: true, loads, grossRevenue: (loads * (145000 + activity * 1700) / 100).toFixed(2), dispatchFees: (loads * (8500 + activity * 125) / 100).toFixed(2), refunds: (u + day) % 29 === 0 ? "25.00" : "0.00", adjustments: (u + day) % 31 === 0 ? "10.00" : "0.00", currency: "USD", notes: "DEMO — synthetic sample performance; not actual revenue or business results.", source: "MANUAL", state, submittedAt: state === "DRAFT" ? null : submittedAt, approvedAt: state === "APPROVED" ? new Date(submittedAt.getTime() + 3600000) : null, approvedById: state === "APPROVED" ? id("manager", team) : null, updatedAt: now });
      }
    }
    await insert("Setting", { key: marker, value: JSON.stringify({ label: "DEMO", version: 1, dispatchers: 64, managers: 4, teams: 4, campaigns: 8, leads: 192, performance: 3840, endDate: today.toISOString() }), updatedAt: now });
    await insert("AuditEvent", { id: `${prefix}audit`, action: "DEMO_SEED_CREATED", entityType: "Setting", entityId: marker, metadata: JSON.stringify({ label: "DEMO", description: "Explicit local seed; no passwords, sessions, accounts, invitations or existing records changed." }) });
    console.log("DEMO created: 64 dispatchers, 4 managers, 4 teams, 8 campaigns, 192 leads, 3,840 records / 60 days. No login credentials created.");
  }
  await db.query("COMMIT");
} catch (error) {
  await db.query("ROLLBACK");
  // Never echo a connection string or SQL parameter values.
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]") : "DEMO seed failed");
  process.exitCode = 1;
} finally { await db.end(); }

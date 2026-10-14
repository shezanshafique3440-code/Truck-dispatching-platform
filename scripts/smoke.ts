import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { verifyPerformanceJourney } from "./performance-journey";
import { verifyImportJourney } from "./import-journey";
import { verifyApplicationJourney } from "./application-journey";
import { verifyLeadJourney } from "./lead-journey";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated, migrated database whose name ends in _test. Never target production.");
const base = process.env.SMOKE_BASE_URL ?? "https://localhost:3443";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("Use a local test server.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const passphrase = randomBytes(24).toString("hex");
const prefix = `fixture-${randomBytes(5).toString("hex")}`;
let checks = 0; let fixturesStarted = false; let privateDirectory = "";
type Result = { response: Response; body: Record<string, unknown> | Record<string, unknown>[]; text: string };
async function request(path: string, cookie = "", method = "GET", body?: unknown, origin = base): Promise<Result> {
  const response = await fetch(base + path, { method, redirect: "manual", headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method !== "GET" ? { "Content-Type": "application/json", Origin: origin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text(); let data: Result["body"] = {}; try { data = JSON.parse(text); } catch { /* HTML or CSV */ }
  return { response, body: data, text };
}
function status(result: Result, expected: number) { assert.equal(result.response.status, expected); checks++; }
async function login(email: string, password = passphrase) {
  const result = await request("/api/auth/sign-in/email", "", "POST", { email, password }); status(result, 200);
  const values = result.response.headers.getSetCookie();
  const session = values.find(value => value.includes("session_token=")); assert.ok(session, "A session cookie must be issued");
  assert.ok(/httponly/i.test(session)); assert.ok(/samesite=lax/i.test(session)); assert.ok(/path=\//i.test(session));
  if (base.startsWith("https://")) assert.ok(/;\s*secure/i.test(session));
  assert.ok(!/;\s*domain=/i.test(session)); assert.ok(!result.text.includes('"token"'), "Login JSON must not expose the bearer token"); checks++;
  return values.map(value => value.split(";")[0]).filter(value => !value.endsWith("=")).join("; ");
}
async function create(resource: string, cookie: string, body: unknown) { const result = await request(`/api/workspace/${resource}`, cookie, "POST", body); status(result, 201); return result.body as Record<string, unknown>; }
async function invite(cookie: string, email: string, role: string, teamIds: string[] = []) {
  const invitation = await create("invitations", cookie, { email, role, teamIds });
  const token = new URLSearchParams(new URL(String(invitation.invitationURL)).hash.slice(1)).get("token"); assert.ok(token);
  status(await request("/api/invitations/accept", "", "POST", { token, email, name: `${prefix}-${role.toLowerCase()}-${randomBytes(3).toString("hex")}`, password: passphrase }), 200);
  return { cookie: await login(email), user: await db.user.findUniqueOrThrow({ where: { email } }), invitation, token };
}
try {
  assert.equal(await db.user.count(), 0, "The test database must start empty");
  assert.equal(await db.team.count(), 0, "The test database must contain no existing business data");
  assert.equal(await db.campaign.count(), 0); assert.equal(await db.lead.count(), 0); assert.equal(await db.performanceEntry.count(), 0);
  fixturesStarted = true;
  let bootstrapFile = process.env.BOOTSTRAP_INVITATION_FILE;
  if (!await db.invitation.count({ where: { bootstrap: true, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } })) {
    privateDirectory = await mkdtemp(join(tmpdir(), "northlane-auth-smoke-")); bootstrapFile = join(privateDirectory, "admin-invitation.txt");
    const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/bootstrap-admin.ts", "--email", `${prefix}-admin@example.invalid`, "--output", bootstrapFile], { env: { ...process.env, DATABASE_URL: url, APP_URL: base }, encoding: "utf8" });
    assert.equal(result.status, 0, "Bootstrap CLI must create the first invitation"); checks++;
  }
  if (!bootstrapFile) throw new Error("A pending test bootstrap invitation requires BOOTSTRAP_INVITATION_FILE.");
  status(await request("/"), 200);
  const anonymous = await request("/dashboard"); status(anonymous, 307); assert.equal(anonymous.response.headers.get("location"), "/login");
  for (const resource of ["teams", "campaigns", "leads", "performance", "users", "memberships", "assignments", "invitations", "audit", "settings"]) status(await request(`/api/workspace/${resource}`), 401);
  for (const resource of ["leads", "performance", "users"]) status(await request(`/api/workspace/${resource}/export`), 401);
  status(await request("/api/auth/sign-up/email", "", "POST", { email: "outsider@example.invalid", password: passphrase, name: "Outsider" }), 404);
  status(await request("/api/auth/update-user", "", "POST", { role: "ADMIN" }), 404);
  const bootstrapURL = (await readFile(bootstrapFile, "utf8")).trim();
  const token = new URLSearchParams(new URL(bootstrapURL).hash.slice(1)).get("token");
  const bootstrap = await db.invitation.findFirstOrThrow({ where: { bootstrap: true, acceptedAt: null } });
  status(await request("/api/invitations/accept", "", "POST", { token, email: bootstrap.email, name: `${prefix}-admin`, password: passphrase, role: "ADMIN" }), 400);
  status(await request("/api/invitations/accept", "", "POST", { token, email: bootstrap.email, name: `${prefix}-admin`, password: passphrase }), 200);
  status(await request("/api/invitations/accept", "", "POST", { token, email: bootstrap.email, name: "Replay", password: passphrase }), 400);
  let admin = await login(bootstrap.email); const adminUser = await db.user.findUniqueOrThrow({ where: { email: bootstrap.email } });
  status(await request(`/api/workspace/users/${adminUser.id}`, admin, "PATCH", { active: false }), 409);
  status(await request("/api/workspace/teams", admin, "POST", { name: "Cross-site team" }, "https://untrusted.example"), 403);
  status(await request("/api/workspace/teams", admin, "POST", { name: "Bad body", role: "ADMIN" }), 400);
  const a = await create("teams", admin, { name: `${prefix}-team-a` }); const b = await create("teams", admin, { name: `${prefix}-team-b` });
  const teamA = String(a.id); const teamB = String(b.id);
  const revoked = await create("invitations", admin, { email: `${prefix}-revoked@example.invalid`, role: "DISPATCHER" });
  const revokedToken = new URLSearchParams(new URL(String(revoked.invitationURL)).hash.slice(1)).get("token");
  status(await request(`/api/workspace/invitations/${revoked.id}`, admin, "PATCH", { revoked: true }), 200);
  status(await request("/api/invitations/accept", "", "POST", { token: revokedToken, email: revoked.email, name: "Revoked fixture", password: passphrase }), 400);
  const expiredInvite = await create("invitations", admin, { email: `${prefix}-expired@example.invalid`, role: "DISPATCHER" });
  await db.invitation.update({ where: { id: String(expiredInvite.id) }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const expiredToken = new URLSearchParams(new URL(String(expiredInvite.invitationURL)).hash.slice(1)).get("token");
  status(await request("/api/invitations/accept", "", "POST", { token: expiredToken, email: expiredInvite.email, name: "Expired fixture", password: passphrase }), 400);
  const manager = await invite(admin, `${prefix}-manager@example.invalid`, "MANAGER", [teamA]);
  const dispatcher = await invite(admin, `${prefix}-dispatcher@example.invalid`, "DISPATCHER", [teamA]);
  const other = await invite(admin, `${prefix}-other@example.invalid`, "DISPATCHER", [teamB]);
  const unassigned = await invite(admin, `${prefix}-unassigned@example.invalid`, "MANAGER");
  const cA = await create("campaigns", admin, { name: `${prefix}-campaign-a`, teamId: teamA });
  const cUnassigned = await create("campaigns", admin, { name: `${prefix}-unassigned-campaign`, teamId: teamA });
  const cB = await create("campaigns", admin, { name: `${prefix}-campaign-b`, teamId: teamB });
  const campaignA = String(cA.id); const campaignB = String(cB.id);
  for (const [userId, campaignId] of [[manager.user.id, campaignA], [dispatcher.user.id, campaignA], [other.user.id, campaignB]]) await create("assignments", admin, { userId, campaignId, operation: "add" });
  status(await request(`/api/workspace/campaigns/${campaignB}`, manager.cookie), 404);
  status(await request(`/api/workspace/campaigns/${cUnassigned.id}`, manager.cookie), 404);
  status(await request(`/api/workspace/teams/${teamB}`, manager.cookie), 404);
  status(await request(`/api/workspace/teams/${teamB}`, manager.cookie, "PATCH", { name: "Tampered" }), 404);
  status(await request("/api/workspace/users", manager.cookie), 403);
  status(await request("/api/workspace/users/export", manager.cookie), 403);
  status(await request("/api/workspace/memberships", manager.cookie, "POST", { userId: manager.user.id, teamId: teamB, operation: "add" }), 403);
  status(await request("/api/workspace/campaigns", manager.cookie, "POST", { name: "Outside", teamId: teamB }), 404);
  const managerCreated = await create("campaigns", manager.cookie, { name: `${prefix}-manager-created`, teamId: teamA });
  status(await request(`/api/workspace/campaigns/${managerCreated.id}`, manager.cookie), 200);
  const leadA = await create("leads", admin, { name: "=1+1", campaignId: campaignA, assignedToId: dispatcher.user.id });
  const leadB = await create("leads", admin, { name: `${prefix}-private-lead-b`, campaignId: campaignB, assignedToId: other.user.id });
  const leadUnassigned = await create("leads", admin, { name: `${prefix}-not-assigned-lead`, campaignId: campaignA });
  checks += await verifyLeadJourney({ api: request, db, base, prefix, admin, manager, dispatcher, other, teamA, teamB, campaignA, campaignB, inaccessibleCampaign: String(cUnassigned.id) });
  status(await request(`/api/workspace/leads/${leadB.id}`, manager.cookie), 404);
  status(await request(`/api/workspace/leads/${leadB.id}`, manager.cookie, "PATCH", { status: "LOST" }), 404);
  status(await request(`/api/workspace/leads/${leadA.id}`, dispatcher.cookie), 200);
  status(await request(`/api/workspace/leads/${leadUnassigned.id}`, dispatcher.cookie), 404);
  status(await request(`/api/workspace/leads/${leadB.id}`, dispatcher.cookie), 404);
  status(await request(`/api/workspace/leads/${leadA.id}`, dispatcher.cookie, "PATCH", { status: "LOST" }), 403);
  status(await request("/api/workspace/assignments", manager.cookie, "POST", { campaignId: campaignA, userId: other.user.id, operation: "add" }), 404);
  status(await request("/api/workspace/assignments", manager.cookie, "POST", { campaignId: campaignA, userId: manager.user.id, operation: "add" }), 404);
  status(await request("/api/workspace/invitations", dispatcher.cookie, "POST", { email: "elevate@example.invalid", role: "ADMIN" }), 403);
  const record = { teamId: teamA, campaignId: campaignA, date: "2026-01-01", loads: 2, grossRevenue: "100.00", currency: "USD" };
  const pA = await create("performance", dispatcher.cookie, record);
  const pB = await create("performance", other.cookie, { ...record, teamId: teamB, campaignId: campaignB });
  status(await request("/api/workspace/performance", dispatcher.cookie, "POST", { ...record, date: "2026-01-02", dispatcherId: other.user.id }), 403);
  status(await request("/api/workspace/performance", dispatcher.cookie, "POST", { ...record, date: "2026-01-02", teamId: teamB }), 404);
  status(await request("/api/workspace/performance", dispatcher.cookie, "POST", { ...record, date: "2026-01-02", campaignId: cUnassigned.id }), 404);
  status(await request("/api/workspace/performance", dispatcher.cookie, "POST", { ...record, date: "2026-02-30" }), 400);
  status(await request("/api/workspace/performance", dispatcher.cookie, "POST", { ...record, loads: -1 }), 400);
  status(await request(`/api/workspace/performance/${pB.id}`, manager.cookie), 404);
  status(await request(`/api/workspace/performance/${pB.id}`, manager.cookie, "PATCH", { action: "saveDraft", version: pB.version, changes: { loads: 3 } }), 404);
  status(await request(`/api/workspace/performance/${pA.id}`, dispatcher.cookie, "PATCH", { action: "saveDraft", version: pA.version, changes: { loads: 3 } }), 200);
  status(await request(`/api/workspace/performance/${pA.id}`, manager.cookie, "PATCH", { action: "saveDraft", version: 2, changes: { loads: 3 } }), 200);
  status(await request(`/api/performance/${pA.id}`, dispatcher.cookie, "PATCH", { action: "submit", version: 3 }), 200);
  status(await request(`/api/performance/${pA.id}`, dispatcher.cookie, "PATCH", { action: "approve", version: 4 }), 403);
  status(await request(`/api/performance/${pA.id}`, manager.cookie, "PATCH", { action: "approve", version: 4 }), 200);
  checks += await verifyPerformanceJourney({ api: request, db, admin, manager, dispatcher, other, teamA, teamB, campaignA, campaignB, inaccessibleCampaign: String(cUnassigned.id), prefix });
  checks += await verifyImportJourney({ api: request, db, base, admin, manager, dispatcher, other, teamA, campaignA, campaignB, inaccessibleCampaign: String(cUnassigned.id), prefix });
  checks += await verifyApplicationJourney({ api: request, db, admin, manager, dispatcher, other, teamA, campaignA, prefix });
  for (const [resource, privateValue] of [["performance", other.user.name], ["leads", String(leadB.name)], ["campaigns", String(cB.name)]]) {
    const exported = await request(`/api/workspace/${resource}/export`, manager.cookie); status(exported, 200); assert.ok(!exported.text.includes(privateValue), "Export must retain authorization scope"); checks++;
  }
  const csv = await request("/api/workspace/leads/export", dispatcher.cookie); status(csv, 200); assert.ok(csv.text.includes("'=1+1"), "CSV formulas must be neutralized"); assert.ok(!csv.text.includes(String(leadUnassigned.name))); checks++;
  const filtered = await request(`/api/workspace/leads?campaignId=${campaignB}`, manager.cookie); status(filtered, 200); assert.deepEqual(filtered.body, []); checks++;
  const none = await request("/api/workspace/performance", unassigned.cookie); status(none, 200); assert.deepEqual(none.body, []);
  status(await request("/api/workspace/settings", manager.cookie, "POST", { reportingTimezone: "UTC", defaultCurrency: "USD" }), 403);
  await create("settings", admin, { reportingTimezone: "UTC", defaultCurrency: "USD" });
  status(await request("/api/workspace/audit", dispatcher.cookie), 403);
  status(await request("/api/workspace/audit/arbitrary", admin, "PATCH", { action: "TAMPERED" }), 403);
  const preservedPerformanceCount = await db.performanceEntry.count({ where: { dispatcherId: dispatcher.user.id } });
  status(await request(`/api/workspace/users/${dispatcher.user.id}`, admin, "PATCH", { active: false }), 200);
  status(await request("/api/workspace/performance", dispatcher.cookie), 401);
  const inactive = await request("/api/auth/sign-in/email", "", "POST", { email: dispatcher.user.email, password: passphrase }); status(inactive, 401);
  assert.equal(await db.performanceEntry.count({ where: { dispatcherId: dispatcher.user.id } }), preservedPerformanceCount); checks++;
  status(await request(`/api/workspace/users/${dispatcher.user.id}`, admin, "PATCH", { active: true }), 200);
  const reactivated = await login(dispatcher.user.email); status(await request("/api/workspace/performance", dispatcher.cookie), 401);
  status(await request("/api/workspace/performance", reactivated), 200);
  status(await request("/api/workspace/memberships", admin, "POST", { userId: manager.user.id, teamId: teamA, operation: "remove" }), 201);
  status(await request(`/api/workspace/campaigns/${campaignA}`, manager.cookie), 404);
  status(await request(`/api/workspace/performance/${pA.id}`, manager.cookie), 404);
  status(await request(`/api/workspace/users/${manager.user.id}`, admin, "PATCH", { role: "DISPATCHER" }), 200);
  status(await request("/api/workspace/campaigns", manager.cookie), 401);
  const adminSecond = await login(bootstrap.email);
  const changedPassword = randomBytes(24).toString("hex");
  const changed = await request("/api/auth/change-password", admin, "POST", { currentPassword: passphrase, newPassword: changedPassword }); status(changed, 200);
  const rotated = changed.response.headers.getSetCookie().map(value => value.split(";")[0]).filter(value => !value.endsWith("="));
  if (rotated.length) admin = rotated.join("; ");
  status(await request("/api/workspace/users", adminSecond), 401); status(await request("/api/workspace/users", admin), 200);
  status(await request("/api/auth/request-password-reset", "", "POST", { email: bootstrap.email }), 503);
  const recovery = await request("/forgot-password"); status(recovery, 200); assert.ok(recovery.text.includes("Password reset email is not connected.")); checks++;
  status(await request("/api/auth/sign-out", reactivated, "POST", {}), 200); status(await request("/api/workspace/performance", reactivated), 401);
  await db.session.updateMany({ where: { userId: other.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  status(await request("/api/workspace/performance", other.cookie), 401);
  await db.rateLimit.deleteMany({});
  const attempts = await Promise.all(Array.from({ length: 9 }, () => request("/api/auth/sign-in/email", "", "POST", { email: `${prefix}-unknown@example.invalid`, password: "an-incorrect-test-passphrase" })));
  assert.equal(attempts.filter(r => r.response.status === 401).length, 5); assert.equal(attempts.filter(r => r.response.status === 429).length, 4); checks++;
  const events = await db.auditEvent.findMany(); assert.ok(events.some(e => e.action === "PERFORMANCE_CORRECTED")); assert.ok(events.some(e => e.action === "AUTH_LOGIN")); assert.ok(events.some(e => e.action === "AUTH_SESSION_REVOKED"));
  assert.ok(!JSON.stringify(events).includes(passphrase)); assert.ok(!JSON.stringify(events).includes(token!)); checks++;
  console.log(`PASS: ${checks} authentication and authorization checks, including invitations, secure cookies, cross-team IDs, scoped exports, deactivation/history, password change/logout/expiry and concurrent throttling.`);
} finally {
  // Destructive cleanup is allowed ONLY by the dedicated *_test database guard above.
  if (fixturesStarted) { await db.auditEvent.deleteMany({}); await db.performanceEntry.deleteMany({}); await db.importBatch.deleteMany({}); await db.lead.deleteMany({}); await db.campaignAssignment.deleteMany({}); await db.campaign.deleteMany({}); await db.membership.deleteMany({}); await db.invitation.deleteMany({}); await db.setting.deleteMany({}); await db.rateLimit.deleteMany({}); await db.user.deleteMany({}); await db.team.deleteMany({}); }
  await db.$disconnect(); if (privateDirectory) await rm(privateDirectory, { recursive: true });
}

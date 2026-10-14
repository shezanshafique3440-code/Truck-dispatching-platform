import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL || !new URL(databaseURL).pathname.endsWith("_test")) throw new Error("Use an empty dedicated *_test database for the browser review. Never target business data.");
export async function reviewFixtures(api: APIRequestContext, base: string) {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseURL }) }); const prefix = `review-${randomBytes(5).toString("hex")}`; const password = randomBytes(24).toString("hex"); let started = false; let directory = "";
  async function post(path: string, data: unknown) { const r = await api.post(path, { data, headers: { Origin: base } }); assert(r.ok(), "Fixture endpoint failed: " + path); return r.json(); }
  const cleanup = async () => {
    if (started) { const users = await db.user.findMany({ select: { email: true } }); assert(users.every(u => u.email.startsWith(prefix + "-")), "Unexpected user entered the disposable fixture database; refuse broad cleanup."); await db.auditEvent.deleteMany(); await db.performanceEntry.deleteMany(); await db.importBatch.deleteMany(); await db.lead.deleteMany(); await db.campaignAssignment.deleteMany(); await db.campaign.deleteMany(); await db.membership.deleteMany(); await db.invitation.deleteMany(); await db.setting.deleteMany(); await db.rateLimit.deleteMany(); await db.verification.deleteMany(); await db.user.deleteMany(); await db.team.deleteMany(); }
    await db.$disconnect(); if (directory) await rm(directory, { recursive: true, force: true });
  };
  try {
    assert.equal(await db.user.count(), 0); assert.equal(await db.team.count(), 0); assert.equal(await db.campaign.count(), 0); assert.equal(await db.lead.count(), 0); assert.equal(await db.performanceEntry.count(), 0); assert.equal(await db.importBatch.count(), 0); started = true;
    directory = await mkdtemp(join(tmpdir(), "northlane-review-invite-")); const file = join(directory, "admin-invitation.txt"); const email = `${prefix}-admin@example.invalid`;
    const boot = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/bootstrap-admin.ts", "--email", email, "--output", file], { env: { ...process.env, DATABASE_URL: databaseURL, APP_URL: base }, encoding: "utf8" }); assert.equal(boot.status, 0, "First-admin fixture bootstrap failed.");
    const token = new URLSearchParams(new URL((await readFile(file, "utf8")).trim()).hash.slice(1)).get("token"); await post("/api/invitations/accept", { token, email, name: "Review fixture Admin", password }); await post("/api/auth/sign-in/email", { email, password });
    const teamA = await post("/api/workspace/teams", { name: "Review fixture team A" }); const teamB = await post("/api/workspace/teams", { name: "Review fixture team B" });
    const campaign = await post("/api/workspace/campaigns", { name: "Review fixture campaign", teamId: teamA.id, timezone: "America/New_York", tracksLoads: true });
    const accounts: Record<string, { email: string; id: string }> = { admin: { email, id: (await db.user.findUniqueOrThrow({ where: { email } })).id } };
    for (const [key, role, teamId] of [["manager", "MANAGER", teamA.id], ["dispatcher", "DISPATCHER", teamA.id], ["outside", "MANAGER", teamB.id]]) {
      const address = `${prefix}-${key}@example.invalid`; const invitation = await post("/api/workspace/invitations", { email: address, role, teamIds: [teamId] }); const keyToken = new URLSearchParams(new URL(invitation.invitationURL).hash.slice(1)).get("token"); await post("/api/invitations/accept", { token: keyToken, email: address, name: "Review fixture " + key, password }); accounts[key] = { email: address, id: (await db.user.findUniqueOrThrow({ where: { email: address } })).id };
      if (key !== "outside") await post("/api/workspace/assignments", { userId: accounts[key].id, campaignId: campaign.id, operation: "add" });
    }
    const producers = Array.from({ length: 60 }, (_, i) => ({ id: randomUUID(), email: `${prefix}-producer-${i}@example.invalid`, name: `Review fixture dispatcher ${String(i + 1).padStart(2, "0")}`, role: "DISPATCHER" as const }));
    await db.user.createMany({ data: producers }); await db.membership.createMany({ data: producers.map(u => ({ userId: u.id, teamId: teamA.id })) }); await db.campaignAssignment.createMany({ data: producers.map(u => ({ userId: u.id, campaignId: campaign.id })) });
    await db.lead.createMany({ data: Array.from({ length: 24 }, (_, i) => ({ name: `Review fixture assigned lead ${i + 1}`, companyName: "Isolated fixture carrier", teamId: teamA.id, campaignId: campaign.id, assignedToId: accounts.dispatcher.id, status: "NEW" as const })) });
    return { db, prefix, password, accounts, teamA, teamB, campaign, producers, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

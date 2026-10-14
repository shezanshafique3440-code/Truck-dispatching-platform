import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import type { PrismaClient } from "../src/generated/prisma/client";
type Result = { response: Response; body: Record<string, unknown> | Record<string, unknown>[]; text: string };
type Api = (path: string, cookie?: string, method?: string, body?: unknown, origin?: string) => Promise<Result>;
type Member = { cookie: string; user: { id: string } };
type Report = { totals: { records: number; carriersSigned: number; qualifiedLeads: number; netFees: string; grossRevenue: string; conversionRate: number | null }; leaderboard: { dispatcherId: string; rank: number; netFees: string; carriersSigned: number }[]; teams: { teamId: string; carriersSigned: number }[]; periods: { from: string; to: string; timezone: string }[]; trend: { date: string; netFees: string }[] };
export async function verifyPerformanceJourney(context: { api: Api; db: PrismaClient; admin: string; manager: Member; dispatcher: Member; other: Member; teamA: string; teamB: string; campaignA: string; campaignB: string; inaccessibleCampaign: string; prefix: string }) {
  const { api, db, admin, manager, dispatcher, other, teamA, teamB, campaignA, campaignB, inaccessibleCampaign, prefix } = context;
  let checks = 0;
  async function settle<T>(promises: Promise<T>[]) { const outcomes = await Promise.allSettled(promises); const failed = outcomes.find(r => r.status === "rejected"); if (failed?.status === "rejected") throw failed.reason; return outcomes.map(r => (r as PromiseFulfilledResult<T>).value); }
  function check(value: unknown, message?: string) { assert.ok(value, message); checks++; }
  async function expectStatus(path: string, expected: number, cookie = "", method = "GET", body?: unknown) { const r = await api(path, cookie, method, body); assert.equal(r.response.status, expected, `${method} ${path}: ${r.text.slice(0, 150)}`); checks++; return r; }
  async function command(id: string, action: string, cookie: string, version: number, extras = {}) { const r = await expectStatus(`/api/performance/${id}`, 200, cookie, "PATCH", { action, version, ...extras }); return r.body as Record<string, unknown>; }
  async function report(cookie = admin, extras: Record<string, string> = {}) { const query = new URLSearchParams({ campaignId: campaignA, currency: "USD", period: "monthly", anchor: "2026-10-13", ...extras }); return (await expectStatus(`/api/performance/report?${query}`, 200, cookie)).body as unknown as Report; }
  async function create(data: unknown, cookie = admin) { return (await expectStatus("/api/performance", 201, cookie, "POST", data)).body as Record<string, unknown>; }
  async function approve(record: Record<string, unknown>) { const submitted = await command(String(record.id), "submit", admin, Number(record.version)); return command(String(record.id), "approve", manager.cookie, Number(submitted.version)); }
  const metrics = { callsMade: 10, followUpsCompleted: 3, qualifiedLeads: 4, carriersSigned: 2, loads: 2, dispatchFees: "100.10", refunds: "10.05", adjustments: "-0.01", grossRevenue: "9999.99", notes: "Isolated performance fixture." };
  const body = { ...metrics, campaignId: campaignA, date: "2026-10-12", currency: "USD" };
  for (const path of ["/api/performance", "/api/performance/arbitrary-id", "/api/performance/report?currency=USD", "/api/workspace/performance/export"]) await expectStatus(path, 401);
  await expectStatus("/api/performance", 401, "", "POST", body);
  await expectStatus("/api/performance", 400, dispatcher.cookie, "POST", { ...body, state: "APPROVED" });
  await expectStatus("/api/performance", 400, dispatcher.cookie, "POST", { ...body, dispatchFees: 100.1 });
  await expectStatus("/api/performance", 403, dispatcher.cookie, "POST", { ...body, dispatcherId: other.user.id });
  await expectStatus("/api/performance", 404, manager.cookie, "POST", { ...body, campaignId: campaignB, dispatcherId: other.user.id });
  let first = await create(body, dispatcher.cookie); const id = String(first.id);
  check(first.state === "DRAFT" && first.workTimezone === "UTC" && first.teamId === teamA);
  check((await report()).totals.records === 0, "Drafts must not affect official totals");
  await expectStatus("/api/performance", 409, dispatcher.cookie, "POST", body);
  await expectStatus("/api/performance", 409, dispatcher.cookie, "POST", { ...body, currency: "CAD" });
  await expectStatus(`/api/workspace/campaigns/${campaignA}`, 409, admin, "PATCH", { timezone: "America/New_York" });
  await expectStatus(`/api/performance/${id}`, 404, other.cookie);
  await expectStatus(`/api/performance/${id}`, 400, dispatcher.cookie, "PATCH", { callsMade: 12 });
  first = await command(id, "saveDraft", dispatcher.cookie, Number(first.version), { changes: { callsMade: 12 } });
  first = await command(id, "submit", dispatcher.cookie, Number(first.version)); check(first.state === "SUBMITTED");
  check((await report()).totals.records === 0, "Submitted records must not affect official totals");
  await expectStatus(`/api/performance/${id}`, 409, dispatcher.cookie, "PATCH", { action: "saveDraft", version: first.version, changes: { callsMade: 99 } });
  await expectStatus(`/api/performance/${id}`, 403, dispatcher.cookie, "PATCH", { action: "approve", version: first.version });
  await expectStatus(`/api/performance/${id}`, 404, other.cookie, "PATCH", { action: "approve", version: first.version });
  first = await command(id, "returnToDraft", manager.cookie, Number(first.version), { reason: "Review activity metrics before approval." }); check(first.state === "DRAFT" && first.submittedAt === null);
  first = await command(id, "submit", dispatcher.cookie, Number(first.version)); first = await command(id, "approve", manager.cookie, Number(first.version));
  let r = await report(); check(r.totals.records === 1 && r.totals.netFees === "90.04" && r.totals.grossRevenue === "9999.99" && r.totals.conversionRate === 50);
  await expectStatus(`/api/performance/${id}`, 409, manager.cookie, "PATCH", { action: "approve", version: first.version });
  await expectStatus(`/api/performance/${id}`, 403, dispatcher.cookie, "PATCH", { action: "correct", version: first.version, changes: { dispatchFees: "999" }, reason: "Dispatcher cannot approve their own correction." });
  await expectStatus(`/api/performance/${id}`, 400, manager.cookie, "PATCH", { action: "correct", version: first.version, changes: { dispatchFees: "999" } });
  await expectStatus(`/api/performance/${id}`, 400, manager.cookie, "PATCH", { action: "correct", version: first.version, changes: { currency: "CAD" }, reason: "Changing approved currency without audited replacement." });
  const secondUser = await db.user.create({ data: { name: `${prefix}-tie-dispatcher`, email: `${prefix}-tie@example.invalid`, memberships: { create: { teamId: teamA } }, assignments: { create: { campaignId: campaignA } } } });
  let second = await create({ ...body, dispatcherId: secondUser.id, dispatchFees: "90.04", refunds: "0", adjustments: "0", grossRevenue: null }); second = await approve(second);
  check(second.state === "APPROVED");
  r = await report(); check(r.leaderboard.length === 2 && r.leaderboard.every(row => row.rank === 1), "Exact carriers/fees ties share rank"); check(r.totals.netFees === "180.08");
  first = await command(id, "correct", manager.cookie, Number(first.version), { changes: { carriersSigned: 3, dispatchFees: "100.20" }, reason: "Correct verified carrier count and earned dispatch fee." });
  r = await report(); check(r.totals.records === 2 && r.totals.carriersSigned === 5 && r.totals.netFees === "180.18"); check(r.leaderboard[0].dispatcherId === dispatcher.user.id && r.leaderboard[0].rank === 1 && r.leaderboard[1].rank === 2);
  await expectStatus(`/api/performance/${id}`, 409, manager.cookie, "PATCH", { action: "correct", version: 1, changes: { dispatchFees: "888" }, reason: "A stale correction must not overwrite current work." });
  const simultaneous = await Promise.all(["First", "Second"].map(label => api(`/api/performance/${id}`, manager.cookie, "PATCH", { action: "correct", version: first.version, changes: { notes: `${label} concurrent correction` }, reason: `${label} authorized concurrent correction test.` })));
  check(simultaneous.filter(x => x.response.status === 200).length === 1 && simultaneous.filter(x => x.response.status === 409).length === 1, "Concurrent stale edits must not both commit");
  first = (simultaneous.find(x => x.response.status === 200)!.body as Record<string, unknown>);
  const events = await db.auditEvent.findMany({ where: { entityType: "performance", entityId: id } });
  const correction = events.find(e => e.action === "PERFORMANCE_CORRECTED" && JSON.stringify(e.metadata).includes("100.20"));
  check(Boolean(correction) && JSON.stringify(correction?.metadata).includes("100.10") && JSON.stringify(correction?.metadata).includes("Correct verified carrier count"));
  first = await command(id, "archive", manager.cookie, Number(first.version), { reason: "Temporarily exclude this record pending review." }); check((await report()).totals.netFees === "90.04");
  first = await command(id, "restore", manager.cookie, Number(first.version), { reason: "Review completed; restore approved daily activity." }); check((await report()).totals.netFees === "180.18");
  const cad = await approve(await create({ ...body, dispatcherId: secondUser.id, date: "2026-10-13", currency: "CAD", carriersSigned: 8, qualifiedLeads: 0, dispatchFees: "500", refunds: "0", adjustments: "0" }));
  void cad;
  check((await report()).totals.netFees === "180.18", "CAD must never enter USD totals");
  const cadReport = await report(admin, { currency: "CAD" }); check(cadReport.totals.netFees === "500.00" && cadReport.totals.carriersSigned === 8 && cadReport.totals.conversionRate === null);
  check((await report(admin, { period: "daily", anchor: "2026-10-13" })).totals.records === 0);
  check((await report(admin, { period: "weekly", anchor: "2026-10-13" })).totals.records === 2);
  check((await report(admin, { period: "monthly", anchor: "2026-09-13" })).totals.records === 0, "September report must exclude October activity");
  const noAccess = await report(manager.cookie, { campaignId: inaccessibleCampaign }); check(noAccess.totals.records === 0 && noAccess.leaderboard.length === 0, "Inaccessible campaign filter must return zero totals");
  const outside = await report(other.cookie); check(outside.totals.records === 0);
  const own = await report(dispatcher.cookie); check(own.totals.records === 1 && own.leaderboard.length === 1 && own.leaderboard[0].dispatcherId === dispatcher.user.id);
  const exports = await expectStatus(`/api/workspace/performance/export?currency=CAD&state=APPROVED`, 200, manager.cookie); check(exports.text.includes("500") && !exports.text.includes("100.20"));
  const hiddenExport = await expectStatus(`/api/workspace/performance/export?teamId=${teamB}`, 200, manager.cookie); check(!hiddenExport.text.includes("9999.99"));
  const alternate = (await expectStatus("/api/workspace/campaigns", 201, admin, "POST", { name: `${prefix}-no-loads-NY`, teamId: teamA, timezone: "America/New_York", tracksLoads: false })).body as Record<string, unknown>;
  for (const userId of [dispatcher.user.id, manager.user.id]) await expectStatus("/api/workspace/assignments", 201, admin, "POST", { userId, campaignId: alternate.id, operation: "add" });
  await expectStatus("/api/performance", 400, dispatcher.cookie, "POST", { ...body, campaignId: alternate.id, loads: 1 });
  const otherCampaign = await create({ ...body, campaignId: alternate.id, loads: null }, dispatcher.cookie); check(otherCampaign.loads === null && otherCampaign.workTimezone === "America/New_York", "Same day in another campaign is allowed with explicit campaign key");
  let future = await create({ ...body, campaignId: alternate.id, date: "2099-01-01", loads: null }, dispatcher.cookie);
  await expectStatus(`/api/performance/${future.id}`, 400, dispatcher.cookie, "PATCH", { action: "submit", version: future.version });
  await expectStatus(`/api/performance/${future.id}`, 404, manager.cookie, "PATCH", { action: "saveDraft", version: future.version, changes: { campaignId: campaignB } });
  future = await command(String(future.id), "saveDraft", dispatcher.cookie, Number(future.version), { changes: { date: "2026-10-11", currency: "CAD" } }); check(String(future.date).slice(0, 10) === "2026-10-11" && future.currency === "CAD");
  // 60 isolated active dispatchers, submitted/approved through real application endpoints.
  const users = Array.from({ length: 60 }, (_, i) => ({ id: `${prefix}-load-${i}-${randomBytes(3).toString("hex")}`, name: `${prefix}-load-dispatcher-${i}`, email: `${prefix}-load-${i}@example.invalid` }));
  await db.user.createMany({ data: users }); await db.membership.createMany({ data: users.map(u => ({ userId: u.id, teamId: teamA })) }); await db.campaignAssignment.createMany({ data: users.map(u => ({ userId: u.id, campaignId: campaignA })) });
  const start = performance.now();
  const drafts = await settle(users.map((u, i) => create({ ...body, dispatcherId: u.id, date: "2026-10-10", callsMade: i + 1, qualifiedLeads: 1, carriersSigned: 1, dispatchFees: "0.10", refunds: "0", adjustments: "0", grossRevenue: null })));
  const approved = await settle(drafts.map(record => approve(record)));
  const ingestionMs = performance.now() - start;
  check(approved.every(row => row.state === "APPROVED"));
  r = await report(); check(r.totals.records === 62 && r.leaderboard.length === 62 && r.totals.carriersSigned === 65 && r.totals.netFees === "186.18", "All 60+ dispatchers must enter official totals, beyond old 50-row caps");
  const firstPage = (await expectStatus(`/api/performance?campaignId=${campaignA}&currency=USD&state=APPROVED`, 200, manager.cookie)).body as { total?: unknown; items?: unknown[]; pages?: unknown };
  const lastPage = (await expectStatus(`/api/performance?campaignId=${campaignA}&currency=USD&state=APPROVED&page=4`, 200, manager.cookie)).body as typeof firstPage;
  check(Number(firstPage.total) === 63 && firstPage.items?.length === 20 && lastPage.items?.length === 3);
  const reportStart = performance.now(); const parallelReports = await settle(Array.from({ length: 20 }, () => report(manager.cookie)));
  const reportMs = performance.now() - reportStart; check(parallelReports.every(row => row.totals.netFees === "186.18" && row.leaderboard.length === 62));
  // A second team/campaign contributes only to authorized all-campaign comparison.
  let teamBRecord = await create({ ...body, campaignId: campaignB, dispatcherId: other.user.id, date: "2026-10-14", carriersSigned: 4, dispatchFees: "20.00", refunds: "0", adjustments: "0" });
  teamBRecord = await command(String(teamBRecord.id), "submit", admin, Number(teamBRecord.version)); await command(String(teamBRecord.id), "approve", admin, Number(teamBRecord.version));
  const companyReport = await report(admin, { campaignId: "" }); check(companyReport.teams.some(t => t.teamId === teamB && t.carriersSigned === 4) && companyReport.teams.some(t => t.teamId === teamA && t.carriersSigned === 65));
  const managerReport = await report(manager.cookie, { campaignId: "" }); check(!managerReport.teams.some(t => t.teamId === teamB));
  const workDates = await expectStatus(`/api/performance?campaignId=${campaignA}&from=2026-10-12&to=2026-10-12`, 200, manager.cookie); check(Number((workDates.body as Record<string, unknown>).total) === 2);
  await expectStatus("/api/performance/report?period=weekly", 400, admin);
  await mkdir("/workspace/scratch/northlane-performance", { recursive: true });
  await writeFile("/workspace/scratch/northlane-performance/load-results.json", JSON.stringify({ fixtureDispatchers: 60, ingestionMs: Math.round(ingestionMs), concurrentReportRequests: 20, concurrentReportBatchMs: Math.round(reportMs), failures: 0, exactUsdNetFees: r.totals.netFees, leaderboardRows: r.leaderboard.length, scope: "Disposable local PostgreSQL/HTTPS test; not a production capacity guarantee" }, null, 2));
  console.log(`PASS: ${checks} campaign-performance checks; 60 dispatchers entered/submitted/approved concurrently in ${Math.round(ingestionMs)} ms, 20 concurrent aggregate requests in ${Math.round(reportMs)} ms.`);
  return checks;
}

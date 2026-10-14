import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { readSheet } from "read-excel-file/node";
import writeExcelFile from "write-excel-file/node";
import { parse } from "csv-parse/sync";
import type { PrismaClient } from "../src/generated/prisma/client";
import { importColumns } from "../src/lib/import-contract";
type Result = { response: Response; body: Record<string, unknown> | Record<string, unknown>[]; text: string };
type Api = (path: string, cookie?: string, method?: string, body?: unknown, origin?: string) => Promise<Result>;
type Member = { cookie: string; user: { id: string } };
type Preview = { batch: { id: string; version: number; state: string; validRows: number; invalidRows: number; mapping: Record<string, number>; mappingErrors: unknown[] }; rows: { rowNumber: number; valid: boolean; errors: { message: string }[] }[]; total: number; pages: number };
export async function verifyImportJourney(c: { api: Api; db: PrismaClient; base: string; admin: string; manager: Member; dispatcher: Member; other: Member; teamA: string; campaignA: string; campaignB: string; inaccessibleCampaign: string; prefix: string }) {
  const { api, db, base, admin, manager, dispatcher, other, teamA, campaignA, campaignB, inaccessibleCampaign, prefix } = c;
  let checks = 0; const columns = importColumns.map(c => c.key);
  const check = (value: unknown, message?: string) => { assert.ok(value, message); checks++; };
  async function expected(path: string, status: number, cookie = admin, method = "GET", body?: unknown) { const r = await api(path, cookie, method, body); assert.equal(r.response.status, status, `${method} ${path}: ${r.text.slice(0, 180)}`); checks++; return r; }
  async function upload(bytes: Uint8Array | string, name: string, cookie = admin, campaignId = campaignA, requestKey = randomUUID(), origin = base, status = 201) {
    const form = new FormData(); form.set("campaignId", campaignId); form.set("requestKey", requestKey); form.set("file", new Blob([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], { type: name.endsWith("csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
    const r = await fetch(base + "/api/performance/imports", { method: "POST", headers: { Cookie: cookie, Origin: origin }, body: form }); const text = await r.text(); const body = JSON.parse(text) as { id: string; duplicateUpload?: boolean };
    assert.equal(r.status, status, "Upload: " + text.slice(0, 180)); checks++; return body;
  }
  const csv = (rows: Record<string, string>[], headers: readonly string[] = columns) => [headers, ...rows.map(r => headers.map(k => r[k] ?? ""))].map(r => r.map(v => '"' + v.replaceAll('"', '""') + '"').join(",")).join("\r\n");
  const daily = (userId: string, date = "2026-09-15", overrides: Record<string, string> = {}) => ({ work_date: date, campaign_id: campaignA, dispatcher_id: userId, dispatcher_email: "", calls_made: "15", follow_ups_completed: "4", qualified_leads: "5", carriers_signed: "2", loads_booked: "1", dispatch_fees: "100.10", refunds: "10.05", adjustments: "-0.01", currency: "USD", gross_freight_revenue: "5000.00", notes: "Isolated import fixture", ...overrides });
  async function preview(batchId: string, cookie = admin, query = "") { return (await expected(`/api/performance/imports/${batchId}${query}`, 200, cookie)).body as unknown as Preview; }
  async function confirm(batchId: string, version: number, cookie = admin, status = 200) { return expected(`/api/performance/imports/${batchId}/confirm`, status, cookie, "POST", { version, confirm: true }); }
  const users = await db.user.findMany({ where: { id: { startsWith: `${prefix}-load-` } }, orderBy: { id: "asc" } }); check(users.length === 60);
  await db.user.update({ where: { id: users[0].id }, data: { emailVerified: true } });
  for (const path of ["/api/performance/imports", "/api/performance/imports/template?format=csv", "/api/performance/imports/template?format=xlsx", `/api/performance/imports/directory?campaignId=${campaignA}`, "/api/performance/export", "/api/performance/export?format=xlsx", "/api/performance/report/export?currency=USD&format=xlsx"]) await expected(path, 401, "");
  await upload(csv([daily(dispatcher.user.id)]), "anonymous.csv", "", campaignA, randomUUID(), base, 401);
  await upload(csv([daily(dispatcher.user.id)]), "origin.csv", admin, campaignA, randomUUID(), "https://outside.example", 403);
  await upload(csv([daily(other.user.id)]), "outside.csv", manager.cookie, campaignB, randomUUID(), base, 404);
  await upload(csv([daily(dispatcher.user.id)]), "unassigned.csv", manager.cookie, inaccessibleCampaign, randomUUID(), base, 404);
  await upload(csv([daily(dispatcher.user.id)]), "bad.xls", admin, campaignA, randomUUID(), base, 400);
  await upload('a,b\n"unterminated', "broken.csv", admin, campaignA, randomUUID(), base, 400);
  await upload(new Uint8Array(2 * 1024 * 1024 + 1), "large.csv", admin, campaignA, randomUUID(), base, 413);
  const directory = (await expected(`/api/performance/imports/directory?campaignId=${campaignA}&page=4`, 200, manager.cookie)).body as { total?: number; items?: unknown[] }; check(Number(directory.total) >= 62 && directory.items!.length >= 2, "Directory must include the 50+ scope");
  const outsideDirectory = await expected(`/api/performance/imports/directory?campaignId=${campaignB}`, 404, manager.cookie); void outsideDirectory;
  const template = await expected("/api/performance/imports/template?format=csv", 200); check(parse(template.text, { bom: true })[0].join(",") === columns.join(","));
  const templateResponse = await fetch(base + "/api/performance/imports/template?format=xlsx", { headers: { Cookie: admin } }); check(templateResponse.ok); check((await readSheet(Buffer.from(await templateResponse.arrayBuffer()), "Performance"))[0].join(",") === columns.join(","));
  const bulkRows = users.map((u, i) => daily(u.id, "2026-09-15", i === 0 ? { dispatcher_id: "", dispatcher_email: u.email } : {}));
  const contents = csv(bulkRows); const key = randomUUID(); const countBefore = await db.performanceEntry.count();
  const staged = await upload(contents, "sixty.csv", admin, campaignA, key); let p = await preview(staged.id);
  check(p.batch.validRows === 60 && p.batch.invalidRows === 0 && p.rows.length === 20 && p.total === 60 && p.pages === 3);
  check(await db.performanceEntry.count() === countBefore, "Upload/preview must not create performance records");
  check((await preview(staged.id, admin, "?page=3")).rows.length === 20);
  await expected(`/api/performance/imports/${staged.id}`, 404, manager.cookie); await expected(`/api/performance/imports/${staged.id}`, 404, other.cookie);
  const replay = await upload(contents, "renamed.csv", admin, campaignA, key); check(replay.id === staged.id && replay.duplicateUpload);
  check((await upload(contents, "retry.csv")).id === staged.id);
  await upload(csv([daily(dispatcher.user.id, "2026-09-16")]), "conflict.csv", admin, campaignA, key, base, 409);
  await expected(`/api/performance/imports/${staged.id}/confirm`, 400, admin, "POST", { version: p.batch.version, confirm: false });
  await expected(`/api/performance/imports/${staged.id}/confirm`, 400, admin, "POST", { version: p.batch.version, confirm: true, state: "APPROVED" });
  await confirm(staged.id, p.batch.version, other.cookie, 404);
  const commits = await Promise.all([confirm(staged.id, p.batch.version), confirm(staged.id, p.batch.version)]);
  check(commits.some(r => (r.body as { alreadyCommitted?: boolean }).alreadyCommitted === true));
  const imported = await db.performanceEntry.findMany({ where: { importBatchId: staged.id } });
  const importedBatch = await db.importBatch.findUniqueOrThrow({ where: { id: staged.id } });
  check(imported.length === 60 && imported.every(r => r.source === "IMPORT" && r.state === "DRAFT" && r.submittedById === importedBatch.importedById));
  check(imported.every(r => r.dispatchFees.toFixed(2) === "100.10" && r.adjustments.toFixed(2) === "-0.01" && r.grossRevenue?.toFixed(2) === "5000.00" && r.importRowId));
  check(await db.performanceEntry.count() === countBefore + 60); check((await upload(contents, "again.csv")).id === staged.id);
  const prior = await expected(`/api/performance/report?campaignId=${campaignA}&currency=USD&period=monthly&anchor=2026-09-15`, 200); check((prior.body as { totals: { records: number } }).totals.records === 0);
  const review = imported[0]; const submitted = (await expected(`/api/performance/${review.id}`, 200, manager.cookie, "PATCH", { action: "submit", version: 1 })).body as { version: number };
  await expected(`/api/performance/${review.id}`, 404, dispatcher.cookie, "PATCH", { action: "approve", version: submitted.version });
  await expected(`/api/performance/${review.id}`, 200, manager.cookie, "PATCH", { action: "approve", version: submitted.version });
  const report = (await expected(`/api/performance/report?campaignId=${campaignA}&currency=USD&period=monthly&anchor=2026-09-15`, 200)).body as { totals: { records: number; netFees: string } }; check(report.totals.records === 1 && report.totals.netFees === "90.04");
  const parsedXlsx = await writeExcelFile([columns.map(value => ({ value })), ...bulkRows.map(r => columns.map(k => ({ value: r[k as keyof typeof r] ?? "" })))], { sheet: "Performance" }).toBuffer();
  const duplicateFormat = await upload(parsedXlsx, "same-rows.xlsx"); const duplicatePreview = await preview(duplicateFormat.id); check(duplicatePreview.batch.validRows === 0 && duplicatePreview.batch.invalidRows === 60); await confirm(duplicateFormat.id, duplicatePreview.batch.version, admin, 400);
  const malformed = [daily(users[1].id, "2026-09-16"), daily(users[1].id, "2026-09-16"), daily(users[2].id, "2026-02-30"), daily(users[3].id, "2026-09-16", { dispatch_fees: "10.005" }), daily(users[4].id, "2026-09-16", { calls_made: "-1" }), daily(users[5].id, "2026-09-16", { currency: "XYZ" }), daily(users[6].id, "2026-09-16", { dispatcher_id: "", dispatcher_email: users[6].email }), daily(other.user.id, "2026-09-16"), daily(users[7].id, "2026-09-16", { campaign_id: campaignB }), daily(users[8].id, "2026-09-16", { notes: '=HYPERLINK("https://example.invalid", "literal note")' })];
  const bad = await upload(csv(malformed), "mixed.csv", manager.cookie); p = await preview(bad.id, manager.cookie); check(p.batch.validRows === 1 && p.batch.invalidRows === 9); check((await preview(bad.id, manager.cookie, "?rows=errors")).total === 9);
  await confirm(bad.id, p.batch.version, manager.cookie); check(await db.performanceEntry.count({ where: { importBatchId: bad.id } }) === 1);
  await db.user.update({ where: { id: manager.user.id }, data: { role: "DISPATCHER" } });
  await expected(`/api/performance/imports/${bad.id}`, 404, manager.cookie);
  await expected(`/api/performance/imports/${bad.id}/confirm`, 404, manager.cookie, "POST", { version: p.batch.version, confirm: true });
  await upload(csv(malformed), "downgraded-retry.csv", manager.cookie, campaignA, randomUUID(), base, 404);
  await db.user.update({ where: { id: manager.user.id }, data: { role: "MANAGER" } });
  const events = await db.auditEvent.findMany({ where: { action: "PERFORMANCE_IMPORT_COMMITTED", entityId: bad.id } }); check(events.length === 1 && JSON.stringify(events[0].metadata).includes('"skippedRows":9'));
  const unknownHeaders: string[] = [...columns]; unknownHeaders[4] = "Phone calls";
  const remapRows = [{ ...daily(dispatcher.user.id, "2026-09-17"), "Phone calls": "45" }];
  const remap = await upload(csv(remapRows, unknownHeaders), "mapping.csv", manager.cookie); p = await preview(remap.id, manager.cookie); check(p.batch.validRows === 0 && p.batch.mappingErrors.length > 0);
  await expected(`/api/performance/imports/${remap.id}/preview`, 400, manager.cookie, "POST", { version: p.batch.version, mapping: { ...p.batch.mapping, state: 1 } });
  await expected(`/api/performance/imports/${remap.id}/preview`, 200, manager.cookie, "POST", { version: p.batch.version, mapping: { ...p.batch.mapping, calls_made: 4 } });
  await confirm(remap.id, p.batch.version, manager.cookie, 409); p = await preview(remap.id, manager.cookie); check(p.batch.validRows === 1); await confirm(remap.id, p.batch.version, manager.cookie);
  const own = await upload(csv([daily(dispatcher.user.id, "2026-09-18"), daily(users[1].id, "2026-09-18")]), "own-only.csv", dispatcher.cookie); p = await preview(own.id, dispatcher.cookie); check(p.batch.validRows === 1 && p.batch.invalidRows === 1);
  await expected(`/api/performance/imports/${own.id}/preview`, 200, admin, "POST", { version: p.batch.version, mapping: p.batch.mapping });
  p = await preview(own.id, dispatcher.cookie); check(p.batch.validRows === 1 && p.batch.invalidRows === 1, "Staff must not broaden an originally self-only Dispatcher batch"); await confirm(own.id, p.batch.version, dispatcher.cookie);
  const ownRecord = await db.performanceEntry.findFirstOrThrow({ where: { importBatchId: own.id } });
  await expected(`/api/performance/${ownRecord.id}`, 200, dispatcher.cookie, "PATCH", { action: "submit", version: 1 });
  await expected(`/api/performance/${ownRecord.id}`, 403, dispatcher.cookie, "PATCH", { action: "approve", version: 2 });
  const revoked = await upload(csv([daily(dispatcher.user.id, "2026-09-19")]), "recheck.csv", manager.cookie); p = await preview(revoked.id, manager.cookie);
  await db.campaignAssignment.delete({ where: { campaignId_userId: { campaignId: campaignA, userId: dispatcher.user.id } } });
  await confirm(revoked.id, p.batch.version, manager.cookie, 409); const changed = await preview(revoked.id, manager.cookie); check(changed.batch.validRows === 0 && changed.batch.version === p.batch.version + 1); check(await db.performanceEntry.count({ where: { importBatchId: revoked.id } }) === 0);
  await db.campaignAssignment.create({ data: { campaignId: campaignA, userId: dispatcher.user.id } });
  const revokedManager = await upload(csv([daily(dispatcher.user.id, "2026-09-20")]), "manager-scope.csv", manager.cookie); p = await preview(revokedManager.id, manager.cookie);
  await db.campaignAssignment.delete({ where: { campaignId_userId: { campaignId: campaignA, userId: manager.user.id } } });
  await confirm(revokedManager.id, p.batch.version, manager.cookie, 404); await expected(`/api/performance/imports/${revokedManager.id}`, 404, manager.cookie);
  await db.campaignAssignment.create({ data: { campaignId: campaignA, userId: manager.user.id } });
  const expired = await upload(csv([daily(dispatcher.user.id, "2026-09-21")]), "expired.csv", dispatcher.cookie); p = await preview(expired.id, dispatcher.cookie); await db.importBatch.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } }); await confirm(expired.id, p.batch.version, dispatcher.cookie, 410);
  const formulaRows = [columns.map(value => ({ value })), columns.map(k => k === "calls_made" ? { value: "1+1", type: "Formula" as const } : { value: daily(dispatcher.user.id, "2026-09-22")[k as keyof ReturnType<typeof daily>] })];
  const formulaFile = await writeExcelFile(formulaRows, { sheet: "Performance" }).toBuffer(); const formula = await upload(formulaFile, "formula.xlsx", dispatcher.cookie); p = await preview(formula.id, dispatcher.cookie); check(p.batch.validRows === 0 && p.rows[0].errors.some(e => e.message.includes("Formula")));
  const precise = await upload(await writeExcelFile([columns.map(value => ({ value })), columns.map(k => ({ value: daily(dispatcher.user.id, "2026-09-23", { dispatch_fees: "999999999999.99", notes: "Exact XLSX fixture" })[k as keyof ReturnType<typeof daily>] }))], { sheet: "Performance" }).toBuffer(), "precise.xlsx", dispatcher.cookie); p = await preview(precise.id, dispatcher.cookie); check(p.batch.validRows === 1); await confirm(precise.id, p.batch.version, dispatcher.cookie); check((await db.performanceEntry.findFirstOrThrow({ where: { importBatchId: precise.id } })).dispatchFees.toFixed(2) === "999999999999.99");
  // A database constraint failure must roll back the entire confirmed batch, including audit rows.
  assert(new URL(process.env.TEST_DATABASE_URL!).pathname.endsWith("_test"));
  const atomic = await upload(csv([daily(users[9].id, "2026-09-24"), daily(users[10].id, "2026-09-24", { notes: "reject atomic import fixture" })]), "atomic.csv", manager.cookie); p = await preview(atomic.id, manager.cookie);
  try {
    await db.$executeRawUnsafe("CREATE FUNCTION northlane_import_fixture_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.notes = 'reject atomic import fixture' THEN RAISE EXCEPTION 'isolated import constraint fixture'; END IF; RETURN NEW; END $$");
    await db.$executeRawUnsafe('CREATE TRIGGER northlane_import_fixture_reject BEFORE INSERT ON "PerformanceEntry" FOR EACH ROW EXECUTE FUNCTION northlane_import_fixture_reject()');
    await confirm(atomic.id, p.batch.version, manager.cookie, 503); check(await db.performanceEntry.count({ where: { importBatchId: atomic.id } }) === 0); check((await db.importBatch.findUniqueOrThrow({ where: { id: atomic.id } })).state === "STAGED"); check(await db.auditEvent.count({ where: { action: "PERFORMANCE_IMPORT_COMMITTED", entityId: atomic.id } }) === 0);
  } finally { await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS northlane_import_fixture_reject ON "PerformanceEntry"'); await db.$executeRawUnsafe("DROP FUNCTION IF EXISTS northlane_import_fixture_reject()"); }
  await confirm(atomic.id, p.batch.version, manager.cookie); check(await db.performanceEntry.count({ where: { importBatchId: atomic.id } }) === 2);
  // Record exports retain the complete chosen scope, and spreadsheet strings remain inert.
  for (const format of ["csv", "xlsx"]) {
    const r = await fetch(base + `/api/performance/export?importBatchId=${staged.id}&format=${format}`, { headers: { Cookie: manager.cookie } }); check(r.ok && r.headers.get("cache-control") === "private, no-store");
    const data = format === "csv" ? parse(await r.text(), { bom: true }) : await readSheet(Buffer.from(await r.arrayBuffer()), "Report"); check(data.length === 61 && data[0].includes("import_batch_id"));
    const ranking = await fetch(base + `/api/performance/report/export?campaignId=${campaignA}&currency=USD&period=monthly&anchor=2026-10-13&format=${format}`, { headers: { Cookie: manager.cookie } }); check(ranking.ok);
    const ranked = format === "csv" ? parse(await ranking.text(), { bom: true }) : await readSheet(Buffer.from(await ranking.arrayBuffer()), "Report"); check(ranked.length === 63, "Leaderboard export must include all 62 producers beyond UI pagination");
    const hidden = await fetch(base + `/api/performance/export?campaignId=${campaignB}&format=${format}`, { headers: { Cookie: manager.cookie } }); check(hidden.ok); const hiddenData = format === "csv" ? parse(await hidden.text(), { bom: true }) : await readSheet(Buffer.from(await hidden.arrayBuffer()), "Report"); check(hiddenData.length === 1);
  }
  const safeExport = await expected(`/api/performance/export?importBatchId=${bad.id}&format=csv`, 200, manager.cookie); check(safeExport.text.includes("'=HYPERLINK"));
  const ownExport = await expected(`/api/performance/export?importBatchId=${staged.id}&format=csv`, 200, dispatcher.cookie); check(parse(ownExport.text, { bom: true }).length === 1);
  const hiddenRanks = await expected(`/api/performance/report/export?campaignId=${campaignB}&currency=USD&format=csv`, 200, manager.cookie); check(parse(hiddenRanks.text, { bom: true }).length === 1);
  await expected("/api/performance/report/export?period=weekly", 400);
  await expected("/api/performance/export?format=exe", 400);
  await expected("/api/performance/export?from=2026-10-30&to=2026-10-01", 400);
  const largeRows = Array.from({ length: 1000 }, (_, i) => daily(users[i % 60].id, `2025-10-${String(1 + Math.floor(i / 60)).padStart(2, "0")}`));
  const largeStart = performance.now(); const large = await upload(csv(largeRows), "thousand.csv"); p = await preview(large.id); check(p.batch.validRows === 1000 && p.pages === 50); await confirm(large.id, p.batch.version); const largeMs = Math.round(performance.now() - largeStart); check(await db.performanceEntry.count({ where: { importBatchId: large.id } }) === 1000);
  const overflow = await db.user.create({ data: { name: "Isolated export limit fixture", email: `${prefix}-export-limit@example.invalid`, memberships: { create: { teamId: teamA } }, assignments: { create: { campaignId: campaignA } } } });
  const overflowRecords = Array.from({ length: 5001 }, (_, i) => ({ dispatcherId: overflow.id, teamId: teamA, campaignId: campaignA, date: new Date(Date.UTC(2030, 0, i + 1)), loads: 0, currency: "USD", submittedById: overflow.id }));
  for (let start = 0; start < overflowRecords.length; start += 500) await db.performanceEntry.createMany({ data: overflowRecords.slice(start, start + 500) });
  await expected(`/api/performance/export?dispatcherId=${overflow.id}`, 422, manager.cookie);
  await expected(`/api/performance/export?dispatcherId=${overflow.id}&format=xlsx`, 422, manager.cookie);
  await expected(`/api/performance/export?dispatcherId=${overflow.id}&from=2030-01-01&to=2030-01-31`, 200, manager.cookie);
  await mkdir("/workspace/scratch/northlane-imports", { recursive: true });
  await writeFile("/workspace/scratch/northlane-imports/api-results.json", JSON.stringify({ checks, fixtureDispatchers: 60, firstBatchImported: 60, maximumBatchImported: 1000, maximumBatchUploadPreviewCommitMs: largeMs, leaderboardExportRows: 62, existingRowsNeverOverwritten: true, transactionRollbackVerified: true, formulasRejected: true, filteredRoleScopedCsvXlsx: true, scope: "Isolated local PostgreSQL/HTTPS fixtures; no production capacity claim" }, null, 2));
  console.log(`PASS: ${checks} CSV/XLSX import/export checks; 60-dispatcher and 1,000-row transactional batches, safe retries, strict rows and scoped exports.`);
  return checks;
}

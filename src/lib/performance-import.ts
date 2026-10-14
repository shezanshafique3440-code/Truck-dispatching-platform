import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type ImportBatch } from "@/generated/prisma/client";
import { authorizedOperation } from "@/lib/authorized-operation";
import { campaignScope, type Actor } from "@/lib/access";
import { HttpError } from "@/lib/http";
import { id } from "@/lib/validation";
import { importPageQuery, previewInput, confirmInput, inferMapping, mappingIssues, importLimits, stableStringify, type ColumnMapping, type ImportIssue, type RawImportRow } from "@/lib/import-contract";
import { dailyKey, mappedValue, parseImportMetrics, type ImportedDaily } from "@/lib/import-validation";
type Tx = Prisma.TransactionClient;
type CheckedRow = RawImportRow & { id: string; errors: ImportIssue[]; normalized: ImportedDaily | null; valid: boolean };
const jsonValue = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function batchScope(actor: Actor): Prisma.ImportBatchWhereInput {
  return actor.role === "ADMIN" ? {} : { importedById: actor.id, teamId: { in: actor.teamIds }, campaign: campaignScope(actor), ...(actor.role === "DISPATCHER" ? { importRole: "DISPATCHER" as const } : { importRole: { not: null } }) };
}
async function findBatch(tx: Tx, actor: Actor, batchId: string) {
  const batch = await tx.importBatch.findFirst({ where: { AND: [{ id: id.parse(batchId) }, batchScope(actor)] } });
  if (!batch) throw new HttpError(404, "Import batch not found."); return batch;
}
function checkStaged(batch: ImportBatch) {
  if (batch.state !== "STAGED") throw new HttpError(409, "This import is already committed and cannot be changed.");
  if (!batch.expiresAt || batch.expiresAt <= new Date()) throw new HttpError(410, "This preview expired. Upload the file again with a new request key.");
}
async function campaign(tx: Tx, actor: Actor, campaignId: string) {
  const value = await tx.campaign.findFirst({ where: { AND: [{ id: id.parse(campaignId), team: { active: true } }, campaignScope(actor)] } });
  if (!value) throw new HttpError(404, "An active permitted campaign is required."); return value;
}
async function eligible(tx: Tx, actor: Actor, campaignId: string, teamId: string, ownerId?: string) {
  return tx.user.findMany({ where: { active: true, role: "DISPATCHER", ...(actor.role === "DISPATCHER" ? { id: actor.id } : ownerId ? { id: ownerId } : {}), assignments: { some: { campaignId } }, memberships: { some: { teamId } } }, select: { id: true, name: true, email: true, emailVerified: true }, orderBy: [{ name: "asc" }, { id: "asc" }] });
}
async function validate(tx: Tx, actor: Actor, campaignId: string, mapping: ColumnMapping, headers: string[], raw: (RawImportRow & { id: string })[], ownerId?: string) {
  const c = await campaign(tx, actor, campaignId); const users = await eligible(tx, actor, c.id, c.teamId, ownerId);
  const byId = new Map(users.map(u => [u.id, u])); const byEmail = new Map(users.filter(u => u.emailVerified).map(u => [u.email.toLowerCase(), u]));
  const globalIssues = mappingIssues(mapping, headers.length);
  const checked: CheckedRow[] = raw.map(row => {
    const dispatcherId = mappedValue(row, mapping, "dispatcher_id"); const email = mappedValue(row, mapping, "dispatcher_email").toLowerCase();
    const user = dispatcherId ? byId.get(dispatcherId) : byEmail.get(email);
    const errors: ImportIssue[] = [...globalIssues];
    if (!user || email && byEmail.get(email)?.id !== user.id) errors.push({ field: "dispatcher_id", message: "Use an active assigned dispatcher ID or its verified email in your permitted scope. Both identifiers must agree." });
    const parsed = parseImportMetrics(row, mapping, c, user?.id ?? "unresolved"); errors.push(...parsed.errors);
    return { ...row, errors, normalized: parsed.normalized && user ? parsed.normalized : null, valid: false };
  });
  const candidates = checked.filter(r => r.normalized);
  const keys = new Map<string, CheckedRow[]>();
  for (const row of candidates) { const key = dailyKey(row.normalized!.dispatcherId, row.normalized!.date); keys.set(key, [...(keys.get(key) ?? []), row]); }
  for (const group of keys.values()) if (group.length > 1) for (const row of group) row.errors.push({ field: "row", message: `Duplicate daily record within this file (rows ${group.map(r => r.rowNumber).slice(0, 10).join(", ")}${group.length > 10 ? ", …" : ""}). Every occurrence is excluded.` });
  const dates = candidates.map(r => r.normalized!.date).sort();
  const existing = candidates.length ? await tx.performanceEntry.findMany({ where: { campaignId: c.id, dispatcherId: { in: [...new Set(candidates.map(r => r.normalized!.dispatcherId))] }, date: { gte: new Date(`${dates[0]}T00:00:00Z`), lte: new Date(`${dates.at(-1)}T00:00:00Z`) } }, select: { dispatcherId: true, date: true } }) : [];
  const existingKeys = new Set(existing.map(r => dailyKey(r.dispatcherId, r.date.toISOString().slice(0, 10))));
  for (const row of checked) {
    if (row.normalized && existingKeys.has(dailyKey(row.normalized.dispatcherId, row.normalized.date))) row.errors.push({ field: "row", message: "A daily record already exists, including archived history. Import never overwrites it." });
    row.valid = row.normalized !== null && row.errors.length === 0;
  }
  return { campaign: c, context: { timezone: c.timezone, tracksLoads: c.tracksLoads, teamId: c.teamId }, rows: checked, validRows: checked.filter(r => r.valid).length, mappingErrors: globalIssues };
}
function persisted(rows: CheckedRow[], batchId: string) {
  return rows.map(r => ({ id: r.id, batchId, rowNumber: r.rowNumber, cells: jsonValue(r.cells), parseErrors: jsonValue(r.parseErrors), errors: jsonValue(r.errors), normalized: r.normalized ? jsonValue(r.normalized) : Prisma.DbNull, valid: r.valid }));
}
function rawRows(rows: { id: string; rowNumber: number; cells: Prisma.JsonValue; parseErrors: Prisma.JsonValue }[]) { return rows.map(r => ({ id: r.id, rowNumber: r.rowNumber, cells: r.cells as string[], parseErrors: r.parseErrors as ImportIssue[] })); }
async function replaceRows(tx: Tx, batchId: string, rows: CheckedRow[]) { await tx.importRow.deleteMany({ where: { batchId } }); await tx.importRow.createMany({ data: persisted(rows, batchId) }); }
export async function stagePerformanceImport(headers: Headers, input: { campaignId: string; requestKey: string; contentHash: string; filename: string; fileType: string; headers: string[]; rows: RawImportRow[] }) {
  return authorizedOperation(headers, true, async (tx, actor) => {
    const c = await campaign(tx, actor, input.campaignId);
    const priorKey = await tx.importBatch.findUnique({ where: { requestKey: input.requestKey } });
    if (priorKey && (priorKey.importedById !== actor.id || priorKey.campaignId !== c.id || priorKey.contentHash !== input.contentHash)) throw new HttpError(409, "This upload request key belongs to different content. Start a new upload.");
    const previous = priorKey ?? await tx.importBatch.findUnique({ where: { importedById_campaignId_contentHash: { importedById: actor.id, campaignId: c.id, contentHash: input.contentHash } } });
    if (previous) await findBatch(tx, actor, previous.id);
    if (previous && (previous.state === "COMMITTED" || previous.expiresAt && previous.expiresAt > new Date())) return { id: previous.id, state: previous.state, duplicateUpload: true };
    if (previous) {
      if (previous.requestKey === input.requestKey) throw new HttpError(410, "This upload expired. Start a new upload with a new request key.");
      await tx.importBatch.delete({ where: { id: previous.id } });
    }
    const mapping = inferMapping(input.headers); const batchId = randomUUID();
    const checked = await validate(tx, actor, c.id, mapping, input.headers, input.rows.map(r => ({ ...r, id: randomUUID() })));
    await tx.importBatch.create({ data: { id: batchId, fileName: input.filename, fileType: input.fileType, importedById: actor.id, importRole: actor.role, campaignId: c.id, teamId: c.teamId, contentHash: input.contentHash, requestKey: input.requestKey, headers: jsonValue(input.headers), mapping: jsonValue(mapping), validationContext: jsonValue(checked.context), totalRows: input.rows.length, validRows: checked.validRows, invalidRows: input.rows.length - checked.validRows, expiresAt: new Date(Date.now() + importLimits.expiresHours * 3600000) } });
    await tx.importRow.createMany({ data: persisted(checked.rows, batchId) });
    await tx.auditEvent.create({ data: { actorId: actor.id, action: "PERFORMANCE_IMPORT_STAGED", entityType: "import", entityId: batchId, teamId: c.teamId, metadata: { totalRows: input.rows.length, validRows: checked.validRows, fileType: input.fileType } } });
    return { id: batchId, state: "STAGED", duplicateUpload: false };
  });
}
export async function previewPerformanceImport(headers: Headers, batchId: string, body: unknown) {
  const command = previewInput.parse(body);
  return authorizedOperation(headers, true, async (tx, actor) => {
    const batch = await findBatch(tx, actor, batchId); checkStaged(batch);
    if (command.version !== batch.version) throw new HttpError(409, "Preview changed. Reload it before mapping columns.");
    const stored = await tx.importRow.findMany({ where: { batchId: batch.id }, orderBy: { rowNumber: "asc" } });
    const checked = await validate(tx, actor, batch.campaignId!, command.mapping, batch.headers as string[], rawRows(stored), batch.importRole === "DISPATCHER" ? batch.importedById : undefined);
    await replaceRows(tx, batch.id, checked.rows);
    await tx.importBatch.update({ where: { id: batch.id, version: batch.version }, data: { mapping: jsonValue(command.mapping), validationContext: jsonValue(checked.context), validRows: checked.validRows, invalidRows: stored.length - checked.validRows, version: { increment: 1 } } });
    return { id: batch.id, version: batch.version + 1, validRows: checked.validRows, invalidRows: stored.length - checked.validRows };
  });
}
export async function confirmPerformanceImport(headers: Headers, batchId: string, body: unknown) {
  const command = confirmInput.parse(body);
  return authorizedOperation(headers, true, async (tx, actor) => {
    const batch = await findBatch(tx, actor, batchId);
    if (batch.state === "COMMITTED") return { id: batch.id, state: "COMMITTED", importedRows: batch.validRows, skippedRows: batch.invalidRows, alreadyCommitted: true };
    checkStaged(batch);
    if (batch.version !== command.version) throw new HttpError(409, "Preview changed. Review the latest rows before confirming.");
    const stored = await tx.importRow.findMany({ where: { batchId: batch.id }, orderBy: { rowNumber: "asc" } });
    const checked = await validate(tx, actor, batch.campaignId!, batch.mapping as ColumnMapping, batch.headers as string[], rawRows(stored), batch.importRole === "DISPATCHER" ? batch.importedById : undefined);
    const signature = (rows: { rowNumber: number; errors: unknown; normalized: unknown; valid: boolean }[]) => createHash("sha256").update(stableStringify(rows.map(r => [r.rowNumber, r.errors, r.normalized, r.valid]))).digest("hex");
    if (signature(stored) !== signature(checked.rows) || stableStringify(batch.validationContext) !== stableStringify(checked.context)) {
      await replaceRows(tx, batch.id, checked.rows);
      await tx.importBatch.update({ where: { id: batch.id, version: batch.version }, data: { validationContext: jsonValue(checked.context), validRows: checked.validRows, invalidRows: stored.length - checked.validRows, version: { increment: 1 } } });
      return { id: batch.id, reviewRequired: true, error: "Assignments, campaign settings or duplicate records changed. Review the refreshed preview and confirm again." };
    }
    if (!checked.validRows) throw new HttpError(400, "There are no valid rows to import. Fix the file or column mapping first.");
    const rows = checked.rows.filter(r => r.valid);
    const records = rows.map(r => ({ ...r.normalized!, id: randomUUID(), date: new Date(`${r.normalized!.date}T00:00:00Z`), teamId: checked.campaign.teamId, workTimezone: checked.campaign.timezone, loadsRelevant: checked.campaign.tracksLoads, state: "DRAFT" as const, source: "IMPORT" as const, submittedById: actor.id, importBatchId: batch.id, importRowId: r.id }));
    // No skipDuplicates: every valid row and its audit either commit together or all roll back.
    await tx.performanceEntry.createMany({ data: records });
    await tx.auditEvent.createMany({ data: records.map(r => ({ actorId: actor.id, action: "PERFORMANCE_DRAFT_CREATED", entityType: "performance", entityId: r.id, teamId: r.teamId, metadata: jsonValue({ after: { ...r, date: r.date.toISOString().slice(0, 10), state: "DRAFT", version: 1 }, importBatchId: batch.id }) })) });
    await tx.importBatch.update({ where: { id: batch.id, version: batch.version }, data: { state: "COMMITTED", committedAt: new Date(), version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorId: actor.id, action: "PERFORMANCE_IMPORT_COMMITTED", entityType: "import", entityId: batch.id, teamId: batch.teamId, metadata: { importedRows: rows.length, skippedRows: stored.length - rows.length, source: "IMPORT", initialState: "DRAFT" } } });
    return { id: batch.id, state: "COMMITTED", importedRows: rows.length, skippedRows: stored.length - rows.length, alreadyCommitted: false };
  });
}
const batchSelection = { id: true, fileName: true, fileType: true, state: true, version: true, totalRows: true, validRows: true, invalidRows: true, createdAt: true, committedAt: true, expiresAt: true, campaignId: true, campaign: { select: { name: true, timezone: true } }, importedBy: { select: { name: true } } } as const;
export async function listPerformanceImports(headers: Headers, raw: Record<string, string>) {
  const query = importPageQuery.parse(raw);
  return authorizedOperation(headers, false, async (tx, actor) => {
    const where = batchScope(actor); const total = await tx.importBatch.count({ where }); const pages = Math.max(1, Math.ceil(total / 20)); const page = Math.min(query.page, pages);
    const items = await tx.importBatch.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, skip: (page - 1) * 20, select: batchSelection });
    return { items, total, page, pages };
  });
}
export async function getPerformanceImport(headers: Headers, batchId: string, raw: Record<string, string> = {}) {
  const query = importPageQuery.parse(raw);
  return authorizedOperation(headers, false, async (tx, actor) => {
    const batch = await findBatch(tx, actor, batchId);
    const where = { batchId: batch.id, ...(query.rows === "all" ? {} : { valid: query.rows === "valid" }) };
    const total = await tx.importRow.count({ where }); const pages = Math.max(1, Math.ceil(total / 20)); const page = Math.min(query.page, pages);
    const info = await tx.importBatch.findUniqueOrThrow({ where: { id: batch.id }, select: batchSelection });
    const rows = await tx.importRow.findMany({ where, orderBy: { rowNumber: "asc" }, take: 20, skip: (page - 1) * 20, select: { id: true, rowNumber: true, cells: true, errors: true, normalized: true, valid: true, entry: { select: { id: true } } } });
    return { batch: { ...info, headers: batch.headers as string[] | null, mapping: batch.mapping as ColumnMapping | null, mappingErrors: batch.headers ? mappingIssues(batch.mapping as ColumnMapping, (batch.headers as string[]).length) : [], expired: batch.state === "STAGED" && (!batch.expiresAt || batch.expiresAt <= new Date()) }, rows, total, page, pages, filter: query.rows };
  });
}
export async function importDirectory(headers: Headers, campaignId: string, pageInput: string | undefined) {
  const query = importPageQuery.parse({ ...(pageInput ? { page: pageInput } : {}) });
  return authorizedOperation(headers, false, async (tx, actor) => {
    const c = await campaign(tx, actor, campaignId); const all = await eligible(tx, actor, c.id, c.teamId);
    const pages = Math.max(1, Math.ceil(all.length / 20)); const page = Math.min(query.page, pages);
    return { campaign: { id: c.id, name: c.name }, total: all.length, page, pages, items: all.slice((page - 1) * 20, page * 20).map(u => ({ id: u.id, name: u.name, verifiedEmail: u.emailVerified ? u.email : null })) };
  });
}

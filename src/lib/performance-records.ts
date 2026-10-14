import "server-only";
import type { Prisma, PerformanceEntry } from "@/generated/prisma/client";
import { campaignScope, performanceScope, type Actor } from "@/lib/access";
import { HttpError } from "@/lib/http";
import { performanceAction, performanceInput, performanceListQuery, cleanQuery } from "@/lib/performance-validation";
import { localDate, netFees } from "@/lib/performance-math";
type Tx = Prisma.TransactionClient;
export const performanceSelect = {
  id: true, dispatcherId: true, dispatcher: { select: { name: true, active: true } }, teamId: true, team: { select: { name: true } },
  campaignId: true, campaign: { select: { name: true, timezone: true } }, date: true, workTimezone: true,
  callsMade: true, followUpsCompleted: true, qualifiedLeads: true, carriersSigned: true, loads: true, loadsRelevant: true,
  dispatchFees: true, refunds: true, adjustments: true, grossRevenue: true, currency: true, notes: true,
  state: true, version: true, submittedAt: true, submittedBy: { select: { name: true } }, approvedAt: true,
  approvedBy: { select: { name: true } }, archivedAt: true, source: true, createdAt: true, updatedAt: true,
  importBatchId: true, importBatch: { select: { fileName: true, committedAt: true, importedBy: { select: { name: true } } } }, importRow: { select: { rowNumber: true } },
} as const;
function found<T>(value: T | null): T { if (!value) throw new HttpError(404, "Record or campaign assignment not found."); return value; }
function staff(actor: Actor) { if (actor.role === "DISPATCHER") throw new HttpError(403, "Manager or administrator review is required."); }
function evidence(record: Pick<PerformanceEntry, "date" | "campaignId" | "dispatcherId" | "teamId" | "state" | "version" | "callsMade" | "followUpsCompleted" | "qualifiedLeads" | "carriersSigned" | "loads" | "dispatchFees" | "refunds" | "adjustments" | "grossRevenue" | "currency" | "archivedAt" | "notes">) {
  return { date: record.date.toISOString().slice(0, 10), campaignId: record.campaignId, dispatcherId: record.dispatcherId, teamId: record.teamId, state: record.state, version: record.version, callsMade: record.callsMade, followUpsCompleted: record.followUpsCompleted, qualifiedLeads: record.qualifiedLeads, carriersSigned: record.carriersSigned, loads: record.loads, dispatchFees: record.dispatchFees.toFixed(2), refunds: record.refunds.toFixed(2), adjustments: record.adjustments.toFixed(2), netFees: netFees(record.dispatchFees.toFixed(2), record.refunds.toFixed(2), record.adjustments.toFixed(2)), grossRevenue: record.grossRevenue?.toFixed(2) ?? null, currency: record.currency, archived: Boolean(record.archivedAt), notes: record.notes };
}
async function campaignContext(tx: Tx, actor: Actor, campaignId: string, dispatcherId: string) {
  const campaign = found(await tx.campaign.findFirst({ where: { AND: [{ id: campaignId, team: { active: true } }, campaignScope(actor)] } }));
  found(await tx.user.findFirst({ where: { id: dispatcherId, active: true, role: "DISPATCHER", memberships: { some: { teamId: campaign.teamId } }, assignments: { some: { campaignId } } } }));
  return campaign;
}
function checkLoads(relevant: boolean, loads: number | null) { if (relevant && loads === null || !relevant && loads !== null) throw new HttpError(400, relevant ? "Enter loads booked for this record." : "Loads are not applicable to this record; use null."); }
export function performanceFilter(actor: Actor, query: ReturnType<typeof performanceListQuery.parse>): Prisma.PerformanceEntryWhereInput {
  return { AND: [performanceScope(actor), ...(query.teamId ? [{ teamId: query.teamId }] : []), ...(query.campaignId ? [{ campaignId: query.campaignId }] : []), ...(query.dispatcherId ? [{ dispatcherId: query.dispatcherId }] : []), ...(query.importBatchId ? [{ importBatchId: query.importBatchId }] : []), ...(query.currency ? [{ currency: query.currency }] : []), ...(query.state ? [{ state: query.state }] : []), ...(query.archived === "active" ? [{ archivedAt: null }] : []), ...(query.from || query.to ? [{ date: { ...(query.from ? { gte: new Date(`${query.from}T00:00:00Z`) } : {}), ...(query.to ? { lte: new Date(`${query.to}T00:00:00Z`) } : {}) } }] : [])] };
}
export function listPerformanceInTransaction(tx: Tx, actor: Actor, query: Record<string, string>, take: number) {
  const parsed = performanceListQuery.parse(cleanQuery(query));
  return tx.performanceEntry.findMany({ where: performanceFilter(actor, parsed), take, orderBy: [{ date: "desc" }, { id: "desc" }], select: performanceSelect });
}
export async function createPerformanceRecord(tx: Tx, actor: Actor, body: unknown) {
  const data = performanceInput.parse(body); const dispatcherId = data.dispatcherId ?? actor.id;
  if (actor.role === "DISPATCHER" && dispatcherId !== actor.id) throw new HttpError(403, "You can enter only your own performance.");
  const campaign = await campaignContext(tx, actor, data.campaignId, dispatcherId);
  if (data.teamId && data.teamId !== campaign.teamId) throw new HttpError(404, "Campaign does not belong to this team.");
  const loads = data.loads === undefined ? campaign.tracksLoads ? 0 : null : data.loads; checkLoads(campaign.tracksLoads, loads);
  const record = await tx.performanceEntry.create({ data: { dispatcherId, teamId: campaign.teamId, campaignId: campaign.id, date: new Date(`${data.date}T00:00:00Z`), currency: data.currency, workTimezone: campaign.timezone, loadsRelevant: campaign.tracksLoads, loads, callsMade: data.callsMade ?? 0, followUpsCompleted: data.followUpsCompleted ?? 0, qualifiedLeads: data.qualifiedLeads ?? 0, carriersSigned: data.carriersSigned ?? 0, dispatchFees: data.dispatchFees ?? "0", refunds: data.refunds ?? "0", adjustments: data.adjustments ?? "0", grossRevenue: data.grossRevenue ?? null, notes: data.notes ?? null, state: "DRAFT", submittedById: actor.id } });
  await tx.auditEvent.create({ data: { actorId: actor.id, action: "PERFORMANCE_DRAFT_CREATED", entityType: "performance", entityId: record.id, teamId: record.teamId, metadata: { after: evidence(record) } } });
  return record;
}
export async function actOnPerformanceRecord(tx: Tx, actor: Actor, recordId: string, body: unknown) {
  const command = performanceAction.parse(body);
  const before = found(await tx.performanceEntry.findFirst({ where: { AND: [{ id: recordId }, performanceScope(actor)] } }));
  if (command.version !== before.version) throw new HttpError(409, "This record changed. Reload the latest version before saving; your unsaved values are still in the form.");
  if (before.archivedAt && command.action !== "restore") throw new HttpError(409, "Restore this archived record before changing it.");
  const patch: Prisma.PerformanceEntryUncheckedUpdateInput = { version: { increment: 1 } };
  switch (command.action) {
    case "saveDraft": {
      if (before.state !== "DRAFT") throw new HttpError(409, "Only drafts can be edited. Submitted records need review; approved records need an audited correction.");
      const changes = command.changes; const dispatcherId = changes.dispatcherId ?? before.dispatcherId;
      if (actor.role === "DISPATCHER" && dispatcherId !== actor.id) throw new HttpError(403, "You can edit only your own draft.");
      const campaignId = changes.campaignId ?? before.campaignId;
      if (!campaignId) throw new HttpError(400, "Choose a campaign for this legacy record.");
      const campaign = await campaignContext(tx, actor, campaignId, dispatcherId);
      if (changes.teamId && changes.teamId !== campaign.teamId) throw new HttpError(404, "Campaign does not belong to this team.");
      const changedCampaign = campaignId !== before.campaignId;
      const relevant = changedCampaign ? campaign.tracksLoads : before.loadsRelevant;
      const loads = changes.loads === undefined ? changedCampaign ? relevant ? 0 : null : before.loads : changes.loads;
      checkLoads(relevant, loads);
      const { teamId: _teamId, date, ...metrics } = changes; void _teamId;
      Object.assign(patch, metrics, { dispatcherId, campaignId, teamId: campaign.teamId, loads, loadsRelevant: relevant, workTimezone: campaign.timezone }, date ? { date: new Date(`${date}T00:00:00Z`) } : {});
      break;
    }
    case "submit": {
      if (before.state !== "DRAFT") throw new HttpError(409, "Only a draft can be submitted.");
      if (!before.campaignId) throw new HttpError(409, "Assign a campaign to this legacy record before submitting it.");
      await campaignContext(tx, actor, before.campaignId, before.dispatcherId);
      if (before.date.toISOString().slice(0, 10) > localDate(before.workTimezone)) throw new HttpError(400, "Completed work cannot be submitted for a future date in the campaign timezone.");
      Object.assign(patch, { state: "SUBMITTED", submittedAt: new Date(), submittedById: actor.id }); break;
    }
    case "approve": {
      staff(actor); if (before.state !== "SUBMITTED") throw new HttpError(409, "Only submitted records can be approved.");
      if (!before.campaignId || !before.teamId) throw new HttpError(409, "This legacy record needs a campaign. Return it to draft and attach a permitted campaign.");
      Object.assign(patch, { state: "APPROVED", approvedAt: new Date(), approvedById: actor.id }); break;
    }
    case "returnToDraft": {
      staff(actor); if (before.state !== "SUBMITTED") throw new HttpError(409, "Only a submitted record can be returned to draft.");
      Object.assign(patch, { state: "DRAFT", submittedAt: null, approvedAt: null, approvedById: null }); break;
    }
    case "correct": {
      staff(actor); if (before.state !== "APPROVED") throw new HttpError(409, "Only approved records use authorized corrections.");
      checkLoads(before.loadsRelevant, command.changes.loads === undefined ? before.loads : command.changes.loads);
      Object.assign(patch, command.changes, { approvedAt: new Date(), approvedById: actor.id }); break;
    }
    case "archive": { staff(actor); Object.assign(patch, { archivedAt: new Date() }); break; }
    case "restore": { staff(actor); if (!before.archivedAt) throw new HttpError(409, "This record is already active."); Object.assign(patch, { archivedAt: null }); break; }
  }
  const record = await tx.performanceEntry.update({ where: { id: recordId, version: before.version }, data: patch });
  await tx.auditEvent.create({ data: { actorId: actor.id, action: ({ saveDraft: "PERFORMANCE_DRAFT_UPDATED", submit: "PERFORMANCE_SUBMITTED", approve: "PERFORMANCE_APPROVED", returnToDraft: "PERFORMANCE_RETURNED_TO_DRAFT", correct: "PERFORMANCE_CORRECTED", archive: "PERFORMANCE_ARCHIVED", restore: "PERFORMANCE_RESTORED" })[command.action], entityType: "performance", entityId: record.id, teamId: record.teamId, metadata: { before: evidence(before), after: evidence(record), ...("reason" in command ? { reason: command.reason } : {}) } } });
  return record;
}

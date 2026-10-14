import "server-only";
import { authorizedOperation } from "@/lib/authorized-operation";
import { campaignScope, performanceScope, teamScope } from "@/lib/access";
import { actOnPerformanceRecord, createPerformanceRecord, performanceFilter, performanceSelect } from "@/lib/performance-records";
import { cleanQuery, performanceListQuery } from "@/lib/performance-validation";
import { id } from "@/lib/validation";
import { HttpError } from "@/lib/http";
import { localDate } from "@/lib/performance-math";
export async function performanceOptions(headers: Headers) {
  return authorizedOperation(headers, false, async (tx, actor) => {
    const campaigns = await tx.campaign.findMany({ where: { AND: [campaignScope(actor), { team: { active: true } }] }, orderBy: { name: "asc" }, select: { id: true, name: true, teamId: true, timezone: true, tracksLoads: true } });
    const dispatchers = actor.role === "DISPATCHER" ? [{ id: actor.id, name: actor.name, assignments: campaigns.map(c => ({ campaignId: c.id })) }] : await tx.user.findMany({ where: { role: "DISPATCHER", active: true, assignments: { some: { campaign: { AND: [campaignScope(actor), { team: { active: true } }] } } } }, select: { id: true, name: true, assignments: { where: { campaign: campaignScope(actor) }, select: { campaignId: true } } }, orderBy: { name: "asc" } });
    return { campaigns: campaigns.map(c => ({ ...c, today: localDate(c.timezone) })), dispatchers };
  });
}
export async function campaignPeopleOptions(headers: Headers) {
  return authorizedOperation(headers, false, async (tx, actor) => {
    if (actor.role === "DISPATCHER") throw new HttpError(403, "Staff access is required.");
    return tx.user.findMany({ where: { active: true, ...(actor.role === "MANAGER" ? { role: "DISPATCHER" as const } : {}), memberships: { some: { team: teamScope(actor) } } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } });
  });
}
export async function listPerformance(headers: Headers, query: Record<string, string> = {}) {
  return authorizedOperation(headers, false, async (tx, actor) => {
    const parsed = performanceListQuery.parse(cleanQuery(query)); const where = performanceFilter(actor, parsed);
    const total = await tx.performanceEntry.count({ where }); const pages = Math.max(1, Math.ceil(total / 20)); const page = Math.min(pages, parsed.page);
    const items = await tx.performanceEntry.findMany({ where, orderBy: [{ date: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20, select: performanceSelect });
    return { items, total, page, pages, pageSize: 20 };
  });
}
export async function getPerformance(headers: Headers, recordId: string) {
  return authorizedOperation(headers, false, async (tx, actor) => {
    const record = await tx.performanceEntry.findFirst({ where: { AND: [{ id: id.parse(recordId) }, performanceScope(actor)] }, select: performanceSelect });
    if (!record) throw new HttpError(404, "Performance record not found.");
    const events = await tx.auditEvent.findMany({ where: { entityType: "performance", entityId: record.id, ...(actor.role === "MANAGER" ? { teamId: record.teamId } : {}) }, take: 100, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, action: true, createdAt: true, metadata: true, actor: { select: { name: true } } } });
    return { record, events };
  });
}
export function createPerformance(headers: Headers, body: unknown) { return authorizedOperation(headers, true, (tx, actor) => createPerformanceRecord(tx, actor, body)); }
export function updatePerformance(headers: Headers, recordId: string, body: unknown) { return authorizedOperation(headers, true, (tx, actor) => actOnPerformanceRecord(tx, actor, id.parse(recordId), body)); }

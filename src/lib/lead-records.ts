import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { campaignScope, leadScope, teamScope, type Actor } from "@/lib/access";
import { HttpError } from "@/lib/http";
import { leadInput, leadUpdate } from "@/lib/validation";
import { leadQuery, leadWorkflowUpdate, type LeadQuery } from "@/lib/lead-validation";

type Tx = Prisma.TransactionClient;
export const leadSelect = {
  id: true, name: true, companyName: true, email: true, phone: true, equipmentType: true,
  fleetSize: true, preferredContactMethod: true, message: true, source: true, status: true,
  notes: true, teamId: true, team: { select: { name: true } }, campaignId: true,
  campaign: { select: { name: true } }, assignedToId: true, assignedTo: { select: { name: true } },
  followUpDate: true, version: true, notificationStatus: true, createdAt: true, updatedAt: true,
} as const;
export function leadFilter(actor: Actor, query: LeadQuery): Prisma.LeadWhereInput {
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  return { AND: [
    leadScope(actor),
    ...(query.q ? [{ OR: ["name", "companyName", "email", "phone"].map(field => ({ [field]: { contains: query.q, mode: "insensitive" } })) } as Prisma.LeadWhereInput] : []),
    ...(query.status ? [{ status: query.status }] : []),
    ...(query.source ? [{ source: query.source }] : []),
    ...(query.teamId ? [{ teamId: query.teamId }] : []),
    ...(query.campaignId ? [{ campaignId: query.campaignId }] : []),
    ...(query.assignedToId ? [{ assignedToId: query.assignedToId }] : []),
    ...(query.assignment ? [{ assignedToId: query.assignment === "unassigned" ? null : { not: null } }] : []),
    ...(query.triage ? [{ teamId: null }] : []),
    ...(query.followUp === "due" ? [{ followUpDate: { lte: today }, status: { notIn: ["WON", "LOST"] } } as Prisma.LeadWhereInput] : query.followUp === "scheduled" ? [{ followUpDate: { not: null } }] : query.followUp === "none" ? [{ followUpDate: null }] : []),
  ] };
}
export const parseLeadQuery = (query: Record<string, string>) => leadQuery.parse(Object.fromEntries(Object.entries(query).filter(([, value]) => value !== "")));
function staff(actor: Actor) { if (actor.role === "DISPATCHER") throw new HttpError(403, "Only administrators and managers can update leads."); }
function found<T>(record: T | null): T { if (!record) throw new HttpError(404, "Lead or assignment not found."); return record; }
async function audit(tx: Tx, actor: Actor, action: string, id: string, teamId: string | null, metadata?: Prisma.InputJsonValue) {
  await tx.auditEvent.create({ data: { actorId: actor.id, action, entityType: "lead", entityId: id, teamId, metadata } });
}
async function validateDispatcher(tx: Tx, id: string, teamId: string, campaignId: string | null) {
  found(await tx.user.findFirst({ where: { id, role: "DISPATCHER", active: true, memberships: { some: { teamId, team: { active: true } } }, ...(campaignId ? { assignments: { some: { campaignId } } } : {}) } }));
}
export async function createInternalLead(tx: Tx, actor: Actor, body: unknown) {
  staff(actor); const data = leadInput.parse(body);
  const campaign = found(await tx.campaign.findFirst({ where: { AND: [{ id: data.campaignId }, campaignScope(actor), { team: { active: true } }] } }));
  if (data.assignedToId) await validateDispatcher(tx, data.assignedToId, campaign.teamId, campaign.id);
  const record = await tx.lead.create({ data: { ...data, teamId: campaign.teamId } });
  await audit(tx, actor, "LEAD_CREATED", record.id, record.teamId, { status: record.status, assignedToId: record.assignedToId });
  return record;
}

export async function updateLeadRecord(tx: Tx, actor: Actor, id: string, body: unknown, workflow = true) {
  staff(actor);
  const data = workflow ? leadWorkflowUpdate.parse(body) : leadUpdate.parse(body);
  const before = found(await tx.lead.findFirst({ where: { AND: [{ id }, leadScope(actor)] } }));
  if ("version" in data && data.version !== before.version) throw new HttpError(409, "This lead changed since you opened it. Reload to review the latest details; your unsaved entries are kept.");
  const { version: _version, ...patch } = data as Partial<Prisma.LeadUncheckedUpdateInput> & { version?: number };
  void _version;
  const teamId = "teamId" in patch ? patch.teamId as string | null : before.teamId;
  const campaignId = "campaignId" in patch ? patch.campaignId as string | null : before.campaignId;
  const assignedToId = "assignedToId" in patch ? patch.assignedToId as string | null : before.assignedToId;
  if (actor.role !== "ADMIN" && teamId !== before.teamId) throw new HttpError(403, "Only administrators can move leads between teams.");
  const assignmentChanged = teamId !== before.teamId || campaignId !== before.campaignId || assignedToId !== before.assignedToId;
  if (assignmentChanged) {
    if (!teamId && (campaignId || assignedToId)) throw new HttpError(400, "Choose a team before assigning a campaign or dispatcher.");
    if (teamId) found(await tx.team.findFirst({ where: { AND: [{ id: teamId, active: true }, teamScope(actor)] } }));
    if (campaignId && teamId) found(await tx.campaign.findFirst({ where: { AND: [{ id: campaignId, teamId }, campaignScope(actor)] } }));
    if (assignedToId && teamId) await validateDispatcher(tx, assignedToId, teamId, campaignId);
  }
  if ("followUpDate" in patch) patch.followUpDate = patch.followUpDate ? new Date(`${patch.followUpDate}T00:00:00.000Z`) : null;
  const record = await tx.lead.update({ where: { id, version: before.version }, data: { ...patch, version: { increment: 1 } }, select: leadSelect });
  if (before.status !== record.status) await audit(tx, actor, "LEAD_STATUS_CHANGED", id, record.teamId, { from: before.status, to: record.status });
  if (assignmentChanged) await audit(tx, actor, "LEAD_ASSIGNMENT_CHANGED", id, record.teamId, { before: { teamId: before.teamId, campaignId: before.campaignId, assignedToId: before.assignedToId }, after: { teamId: record.teamId, campaignId: record.campaignId, assignedToId: record.assignedToId } });
  if (before.followUpDate?.toISOString() !== record.followUpDate?.toISOString()) await audit(tx, actor, "LEAD_FOLLOW_UP_CHANGED", id, record.teamId, { from: before.followUpDate?.toISOString().slice(0, 10) ?? null, to: record.followUpDate?.toISOString().slice(0, 10) ?? null });
  await audit(tx, actor, "LEAD_UPDATED", id, record.teamId);
  return record;
}

// Removal of memberships or campaign assignments also records each affected lead change.
export async function clearLeadAssignments(tx: Tx, actor: Actor, where: Prisma.LeadWhereInput, reason: string) {
  const leads = await tx.lead.findMany({ where, select: { id: true, teamId: true, assignedToId: true } });
  for (const lead of leads) {
    await tx.lead.update({ where: { id: lead.id }, data: { assignedToId: null, version: { increment: 1 } } });
    await audit(tx, actor, "LEAD_ASSIGNMENT_CHANGED", lead.id, lead.teamId, { from: lead.assignedToId, to: null, reason });
  }
}

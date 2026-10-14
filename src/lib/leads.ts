import "server-only";
import { authorizedOperation } from "@/lib/authorized-operation";
import { leadScope, campaignScope, teamScope } from "@/lib/access";
import { leadSelect, leadFilter, parseLeadQuery, updateLeadRecord } from "@/lib/lead-records";
import { id } from "@/lib/validation";
import { leadNoteInput } from "@/lib/lead-validation";
import { HttpError } from "@/lib/http";
const PAGE_SIZE = 20;

export async function listLeads(headers: Headers, query: Record<string, string> = {}) {
  const filters = parseLeadQuery(query);
  return authorizedOperation(headers, false, async (tx, actor) => {
    const where = leadFilter(actor, filters);
    const total = await tx.lead.count({ where });
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE)); const page = Math.min(filters.page, pages);
    const items = await tx.lead.findMany({ where, select: leadSelect, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    return { items, total, page, pages, pageSize: PAGE_SIZE };
  });
}
export async function leadDetails(headers: Headers, recordId: string) {
  const leadId = id.parse(recordId);
  return authorizedOperation(headers, false, async (tx, actor) => {
    const lead = await tx.lead.findFirst({ where: { AND: [{ id: leadId }, leadScope(actor)] }, select: leadSelect });
    if (!lead) throw new HttpError(404, "Lead not found.");
    const notes = await tx.leadNote.findMany({ where: { leadId }, take: 100, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, body: true, createdAt: true, author: { select: { name: true } } } });
    // Old-team history remains admin-only after a transfer. Public form has no read endpoint.
    const history = await tx.auditEvent.findMany({ where: { entityType: "lead", entityId: leadId, ...(actor.role === "ADMIN" ? {} : { teamId: lead.teamId }) }, take: 100, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, action: true, metadata: true, createdAt: true, actor: { select: { name: true } } } });
    return { lead, notes, history };
  });
}
export async function leadOptions(headers: Headers) {
  return authorizedOperation(headers, false, async (tx, actor) => {
    const teams = await tx.team.findMany({ where: { AND: [teamScope(actor), { active: true }] }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    const campaigns = await tx.campaign.findMany({ where: { AND: [campaignScope(actor), { team: { active: true } }] }, orderBy: { name: "asc" }, select: { id: true, name: true, teamId: true } });
    if (actor.role === "DISPATCHER") return { teams, campaigns, dispatchers: [] };
    // Dispatcher options expose only membership/assignment IDs visible to the actor.
    const dispatchers = await tx.user.findMany({ where: { active: true, role: "DISPATCHER", memberships: { some: { team: { AND: [teamScope(actor), { active: true }] } } } }, orderBy: { name: "asc" }, select: { id: true, name: true, memberships: { where: { team: { AND: [teamScope(actor), { active: true }] } }, select: { teamId: true } }, assignments: { where: { campaign: campaignScope(actor) }, select: { campaignId: true } } } });
    return { teams, campaigns, dispatchers };
  });
}
export async function updateLead(headers: Headers, recordId: string, body: unknown) {
  const leadId = id.parse(recordId);
  return authorizedOperation(headers, true, (tx, actor) => updateLeadRecord(tx, actor, leadId, body));
}
export async function addLeadNote(headers: Headers, recordId: string, body: unknown) {
  const leadId = id.parse(recordId);
  return authorizedOperation(headers, true, async (tx, actor) => {
    if (actor.role === "DISPATCHER") throw new HttpError(403, "Only administrators and managers can add internal notes.");
    const input = leadNoteInput.parse(body);
    const lead = await tx.lead.findFirst({ where: { AND: [{ id: leadId }, leadScope(actor)] }, select: { id: true, teamId: true } });
    if (!lead) throw new HttpError(404, "Lead not found.");
    const note = await tx.leadNote.create({ data: { leadId, authorId: actor.id, body: input.body }, select: { id: true, body: true, createdAt: true, author: { select: { name: true } } } });
    await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "lead", entityId: leadId, teamId: lead.teamId, action: "LEAD_NOTE_ADDED", metadata: { noteId: note.id } } });
    return note;
  });
}
export async function leadCounts(headers: Headers) {
  return authorizedOperation(headers, false, async (tx, actor) => {
    const scope = leadScope(actor);
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    return {
      newInquiries: await tx.lead.count({ where: { AND: [scope, { source: "CONSULTATION", status: "NEW" }] } }),
      untriaged: await tx.lead.count({ where: { AND: [scope, { teamId: null }] } }),
      due: await tx.lead.count({ where: { AND: [scope, { followUpDate: { lte: today }, status: { notIn: ["WON", "LOST"] } }] } }),
    };
  });
}

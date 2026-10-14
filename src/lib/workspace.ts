import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { authorizedOperation as operate } from "@/lib/authorized-operation";
import { campaignScope, leadScope, performanceScope, teamScope, type Actor } from "@/lib/access";
import { HttpError } from "@/lib/http";
import * as input from "@/lib/validation";
import { randomBytes, createHash } from "node:crypto";
import { authConfiguration } from "@/lib/auth-config";
import { z } from "zod";
import { performanceSelect, listPerformanceInTransaction, createPerformanceRecord, actOnPerformanceRecord } from "@/lib/performance-records";
import { clearLeadAssignments, createInternalLead, leadFilter, leadSelect, parseLeadQuery, updateLeadRecord } from "@/lib/lead-records";
export const resources = ["teams", "memberships", "campaigns", "assignments", "leads", "performance", "users", "invitations", "audit", "settings"] as const;
export type Resource = typeof resources[number];
export function resourceName(value: string): Resource { if (!resources.includes(value as Resource)) throw new HttpError(404, "Resource not found."); return value as Resource; }
type Tx = Prisma.TransactionClient;
function admin(actor: Actor) { if (actor.role !== "ADMIN") throw new HttpError(403, "Administrator access is required."); }
function staff(actor: Actor) { if (!["ADMIN", "MANAGER"].includes(actor.role)) throw new HttpError(403, "This action is not available for your role."); }
function found<T>(value: T | null): T { if (!value) throw new HttpError(404, "Record not found."); return value; }
async function audit(tx: Tx, actor: Actor, action: string, entityType: string, entityId?: string, teamId?: string | null, metadata?: Prisma.InputJsonValue) {
  await tx.auditEvent.create({ data: { actorId: actor.id, action, entityType, entityId, teamId, metadata } });
}
const userSelect = { id: true, name: true, email: true, role: true, active: true, createdAt: true, memberships: { select: { teamId: true, team: { select: { name: true } } } } } as const;
const teamSelect = { id: true, name: true, active: true, createdAt: true } as const;
const campaignSelect = { id: true, name: true, description: true, teamId: true, status: true, timezone: true, tracksLoads: true, team: { select: { name: true } }, createdAt: true } as const;

const invitationSelect = { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true, teams: { select: { teamId: true, team: { select: { name: true } } } } } as const;
async function campaign(tx: Tx, actor: Actor, id: string) { return found(await tx.campaign.findFirst({ where: { AND: [{ id }, campaignScope(actor)] } })); }
async function team(tx: Tx, actor: Actor, id: string) { return found(await tx.team.findFirst({ where: { AND: [{ id }, teamScope(actor)] } })); }
async function assignableDispatcher(tx: Tx, userId: string, teamId: string, campaignId?: string) {
  return found(await tx.user.findFirst({ where: { id: userId, active: true, role: "DISPATCHER", memberships: { some: { teamId, team: { active: true } } }, ...(campaignId ? { assignments: { some: { campaignId } } } : {}) } }));
}
const filters = z.object({ teamId: input.id.optional(), campaignId: input.id.optional() }).strict();
async function list(tx: Tx, actor: Actor, resource: Resource, query: Record<string, string>, limit: number) {
  if (resource === "leads") return tx.lead.findMany({ where: leadFilter(actor, parseLeadQuery(query)), take: limit, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: leadSelect });
  if (resource === "performance") return listPerformanceInTransaction(tx, actor, query, limit);
  const filter = filters.parse(query);
  // Relation scopes are applied alongside IDs, never replaced by user-supplied filters.
  switch (resource) {
    case "users": admin(actor); return tx.user.findMany({ take: limit, orderBy: { createdAt: "desc" }, select: userSelect });
    case "teams": return tx.team.findMany({ where: { AND: [teamScope(actor), ...(filter.teamId ? [{ id: filter.teamId }] : [])] }, take: limit, orderBy: { name: "asc" }, select: teamSelect });
    case "memberships": staff(actor); return tx.membership.findMany({ where: { team: teamScope(actor), ...(filter.teamId ? { teamId: filter.teamId } : {}) }, take: limit, select: { userId: true, teamId: true, user: { select: { name: true, role: true, active: true } }, team: { select: { name: true } } } });
    case "campaigns": return tx.campaign.findMany({ where: { AND: [campaignScope(actor), ...(filter.teamId ? [{ teamId: filter.teamId }] : [])] }, take: limit, orderBy: { createdAt: "desc" }, select: campaignSelect });
    case "assignments": staff(actor); return tx.campaignAssignment.findMany({ where: { campaign: { AND: [campaignScope(actor), ...(filter.campaignId ? [{ id: filter.campaignId }] : [])] } }, take: limit, select: { campaignId: true, userId: true, user: { select: { name: true, role: true } }, campaign: { select: { name: true } } } });

    case "invitations": admin(actor); return tx.invitation.findMany({ take: limit, orderBy: { createdAt: "desc" }, select: invitationSelect });
    case "audit": admin(actor); return tx.auditEvent.findMany({ take: limit, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, action: true, entityType: true, entityId: true, teamId: true, metadata: true, createdAt: true, actor: { select: { name: true } } } });
    case "settings": admin(actor); return tx.setting.findMany({ where: { key: "workspace" }, take: 1, select: { key: true, value: true } });
  }
}
export async function listResource(h: Headers, resource: Resource, query: Record<string, string> = {}) { return operate(h, false, (tx, actor) => list(tx, actor, resource, query, 50)); }
export async function paginatedUsers(h: Headers, raw: Record<string, string>) {
  return operate(h, false, async (tx, actor) => {
    admin(actor); const query = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), q: z.string().trim().max(120).default("") }).strict().parse(raw);
    const where: Prisma.UserWhereInput = query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }] } : {};
    const total = await tx.user.count({ where }); const pages = Math.max(1, Math.ceil(total / 20)); const page = Math.min(query.page, pages);
    const items = await tx.user.findMany({ where, skip: (page - 1) * 20, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: userSelect });
    return { items, total, page, pages };
  });
}
export async function allUserChoices(h: Headers) { return operate(h, false, async (tx, actor) => { admin(actor); return tx.user.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, active: true, role: true } }); }); }
export async function getResource(h: Headers, resource: Resource, recordId: string) {
  const id = input.id.parse(recordId);
  return operate(h, false, async (tx, actor) => {
    switch (resource) {
      case "users": admin(actor); return found(await tx.user.findUnique({ where: { id }, select: userSelect }));
      case "teams": return found(await tx.team.findFirst({ where: { AND: [{ id }, teamScope(actor)] }, select: teamSelect }));
      case "campaigns": return found(await tx.campaign.findFirst({ where: { AND: [{ id }, campaignScope(actor)] }, select: campaignSelect }));
      case "leads": return found(await tx.lead.findFirst({ where: { AND: [{ id }, leadScope(actor)] }, select: leadSelect }));
      case "performance": return found(await tx.performanceEntry.findFirst({ where: { AND: [{ id }, performanceScope(actor)] }, select: performanceSelect }));
      case "invitations": admin(actor); return found(await tx.invitation.findUnique({ where: { id }, select: invitationSelect }));
      case "audit": admin(actor); return found(await tx.auditEvent.findUnique({ where: { id }, select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true } }));
      case "settings": admin(actor); if (id !== "workspace") throw new HttpError(404, "Record not found."); return found(await tx.setting.findUnique({ where: { key: id } }));
      default: throw new HttpError(404, "Record not found.");
    }
  });
}
export async function createResource(h: Headers, resource: Resource, body: unknown) {
  return operate(h, true, async (tx, actor) => {
    switch (resource) {
      case "teams": { admin(actor); const data = input.teamInput.parse(body); const record = await tx.team.create({ data }); await audit(tx, actor, "TEAM_CREATED", "team", record.id, record.id); return record; }
      case "campaigns": {
        staff(actor); const data = input.campaignInput.parse(body); const target = await team(tx, actor, data.teamId); if (!target.active) throw new HttpError(409, "Team is inactive.");
        const record = await tx.campaign.create({ data: { ...data, ...(actor.role === "MANAGER" ? { assignments: { create: { userId: actor.id } } } : {}) } });
        await audit(tx, actor, "CAMPAIGN_CREATED", "campaign", record.id, data.teamId); return record;
      }
      case "leads": {
        return createInternalLead(tx, actor, body);
      }
      case "performance": return createPerformanceRecord(tx, actor, body);
      case "invitations": {
        admin(actor); const data = input.inviteInput.parse(body);
        if (await tx.user.findUnique({ where: { email: data.email } })) throw new HttpError(409, "An account already exists for this email.");
        const teamIds = [...new Set(data.teamIds)]; if (await tx.team.count({ where: { id: { in: teamIds }, active: true } }) !== teamIds.length) throw new HttpError(404, "Team not found.");
        const token = randomBytes(32).toString("hex");
        const record = await tx.invitation.create({ data: { email: data.email, role: data.role, tokenHash: createHash("sha256").update(token).digest("hex"), invitedById: actor.id, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), teams: { create: teamIds.map(teamId => ({ teamId })) } }, select: invitationSelect });
        await audit(tx, actor, "INVITATION_CREATED", "invitation", record.id, null, { role: data.role });
        // Returned once to the authenticated admin; raw tokens are never persisted or logged.
        return { ...record, invitationURL: `${authConfiguration().origin}/invite#token=${token}` };
      }
      case "memberships": {
        admin(actor); const data = input.membershipInput.parse(body); found(await tx.user.findUnique({ where: { id: data.userId } })); await team(tx, actor, data.teamId);
        if (data.operation === "add") await tx.membership.upsert({ where: { userId_teamId: { userId: data.userId, teamId: data.teamId } }, create: { userId: data.userId, teamId: data.teamId }, update: {} });
        else {
          await tx.campaignAssignment.deleteMany({ where: { userId: data.userId, campaign: { teamId: data.teamId } } });
          await clearLeadAssignments(tx, actor, { assignedToId: data.userId, teamId: data.teamId }, "team membership removed");
          await tx.membership.deleteMany({ where: { userId: data.userId, teamId: data.teamId } });
        }
        await audit(tx, actor, `MEMBERSHIP_${data.operation.toUpperCase()}`, "membership", data.userId, data.teamId); return { ok: true };
      }
      case "assignments": {
        staff(actor); const data = input.assignmentInput.parse(body); const target = await campaign(tx, actor, data.campaignId);
        if (actor.role === "MANAGER") await assignableDispatcher(tx, data.userId, target.teamId);
        else found(await tx.user.findFirst({ where: { id: data.userId, active: true, memberships: { some: { teamId: target.teamId } } } }));
        if (data.operation === "add") await tx.campaignAssignment.upsert({ where: { campaignId_userId: { campaignId: target.id, userId: data.userId } }, create: { campaignId: target.id, userId: data.userId }, update: {} });
        else { await tx.campaignAssignment.deleteMany({ where: { campaignId: target.id, userId: data.userId } }); await clearLeadAssignments(tx, actor, { campaignId: target.id, assignedToId: data.userId }, "campaign assignment removed"); }
        await audit(tx, actor, `ASSIGNMENT_${data.operation.toUpperCase()}`, "campaign", target.id, target.teamId, { userId: data.userId }); return { ok: true };
      }
      case "settings": { admin(actor); const data = input.settingInput.parse(body); const record = await tx.setting.upsert({ where: { key: "workspace" }, create: { key: "workspace", value: data }, update: { value: data } }); await audit(tx, actor, "SETTINGS_UPDATED", "setting", "workspace"); return record; }
      default: throw new HttpError(403, "This action is not available.");
    }
  });
}
export async function updateResource(h: Headers, resource: Resource, recordId: string, body: unknown) {
  const id = input.id.parse(recordId);
  return operate(h, true, async (tx, actor) => {
    switch (resource) {
      case "teams": { staff(actor); const data = input.teamUpdate.parse(body); if (actor.role !== "ADMIN" && data.active !== undefined) throw new HttpError(403, "Only administrators can deactivate teams."); await team(tx, actor, id); const record = await tx.team.update({ where: { id }, data }); await audit(tx, actor, "TEAM_UPDATED", "team", id, id); return record; }
      case "campaigns": { staff(actor); const data = input.campaignUpdate.parse(body); const target = await campaign(tx, actor, id); if (data.timezone && data.timezone !== target.timezone && await tx.performanceEntry.count({ where: { campaignId: id } })) throw new HttpError(409, "Campaign timezone is locked once performance records exist. Create a separate campaign to use another timezone."); const record = await tx.campaign.update({ where: { id }, data }); await audit(tx, actor, "CAMPAIGN_UPDATED", "campaign", id, target.teamId); return record; }
      case "leads": return updateLeadRecord(tx, actor, id, body, false);
      case "performance": return actOnPerformanceRecord(tx, actor, id, body);
      case "users": {
        admin(actor); const data = input.userUpdate.parse(body);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261014)`;
        const target = found(await tx.user.findUnique({ where: { id } }));
        if (target.role === "ADMIN" && target.active && (data.active === false || (data.role && data.role !== "ADMIN")) && await tx.user.count({ where: { role: "ADMIN", active: true } }) <= 1) throw new HttpError(409, "The last active administrator must remain enabled.");
        const record = await tx.user.update({ where: { id }, data, select: userSelect });
        if (data.active === false || (data.role && data.role !== target.role)) await tx.session.deleteMany({ where: { userId: id } });
        await audit(tx, actor, "USER_UPDATED", "user", id, null, { before: { role: target.role, active: target.active }, after: { role: record.role, active: record.active } }); return record;
      }
      case "invitations": { admin(actor); z.object({ revoked: z.literal(true) }).strict().parse(body); const target = found(await tx.invitation.findUnique({ where: { id } })); if (target.acceptedAt) throw new HttpError(409, "Invitation was already used."); const record = await tx.invitation.update({ where: { id }, data: { revokedAt: new Date() }, select: invitationSelect }); await audit(tx, actor, "INVITATION_REVOKED", "invitation", id); return record; }
      default: throw new HttpError(403, "This action is not available.");
    }
  });
}
export async function exportResource(h: Headers, resource: Resource, query: Record<string, string>) {
  return operate(h, false, async (tx, actor) => {
    if (["memberships", "assignments", "settings", "invitations"].includes(resource)) throw new HttpError(403, "Export is not available for this resource.");
    return list(tx, actor, resource, query, 1000);
  });
}

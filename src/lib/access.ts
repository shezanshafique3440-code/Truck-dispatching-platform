import type { Prisma } from "@/generated/prisma/client";
export type Role = "ADMIN" | "MANAGER" | "DISPATCHER";
export type Actor = { id: string; name: string; role: Role; teamIds: string[]; campaignIds: string[] };
export function isAdmin(actor: Actor) { return actor.role === "ADMIN"; }
export function teamScope(actor: Actor): Prisma.TeamWhereInput {
  if (actor.role === "ADMIN") return {};
  return { id: { in: actor.teamIds }, active: true };
}
export function campaignScope(actor: Actor): Prisma.CampaignWhereInput {
  if (actor.role === "ADMIN") return {};
  return { id: { in: actor.campaignIds }, teamId: { in: actor.teamIds }, team: { active: true } };
}
export function leadScope(actor: Actor): Prisma.LeadWhereInput {
  if (actor.role === "ADMIN") return {};
  return { teamId: { in: actor.teamIds }, team: { active: true }, OR: [{ campaignId: null }, { campaign: campaignScope(actor) }], ...(actor.role === "DISPATCHER" ? { assignedToId: actor.id } : {}) };
}
export function performanceScope(actor: Actor): Prisma.PerformanceEntryWhereInput {
  switch (actor.role) {
    case "ADMIN": return {};
    case "MANAGER": return { teamId: { in: actor.teamIds }, OR: [{ campaignId: null }, { campaignId: { in: actor.campaignIds } }] };
    case "DISPATCHER": return { dispatcherId: actor.id };
    default: return { id: { in: [] } };
  }
}

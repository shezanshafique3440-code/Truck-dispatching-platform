import "server-only";
import { createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getDb } from "@/lib/db";
import { acceptInviteInput } from "@/lib/validation";
import { HttpError } from "@/lib/http";
export async function acceptInvitation(body: unknown) {
  const data = acceptInviteInput.parse(body); const tokenHash = createHash("sha256").update(data.token).digest("hex");
  const candidate = await getDb().invitation.findFirst({ where: { tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, include: { teams: true } });
  if (!candidate || candidate.email !== data.email) throw new HttpError(400, "This invitation is invalid, expired or already used.");
  const passwordHash = await hashPassword(data.password);
  return getDb().$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261014)`;
    if (candidate.bootstrap && await tx.user.count({ where: { role: "ADMIN" } }) > 0) throw new HttpError(409, "An administrator already exists.");
    const inviter = candidate.invitedById ? await tx.user.findFirst({ where: { id: candidate.invitedById, active: true, role: "ADMIN" } }) : null;
    if (!candidate.bootstrap && !inviter) throw new HttpError(400, "This invitation is no longer available.");
    const consumed = await tx.invitation.updateMany({ where: { id: candidate.id, tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
    if (consumed.count !== 1) throw new HttpError(400, "This invitation is invalid, expired or already used.");
    const teamIds = candidate.teams.map(t => t.teamId);
    if (await tx.team.count({ where: { id: { in: teamIds }, active: true } }) !== teamIds.length) throw new HttpError(400, "Invitation assignments are no longer available.");
    const user = await tx.user.create({ data: { email: data.email, name: data.name, role: candidate.role, memberships: { create: teamIds.map(teamId => ({ teamId })) } } });
    await tx.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "INVITATION_ACCEPTED", entityType: "invitation", entityId: candidate.id, metadata: { role: user.role, bootstrap: candidate.bootstrap } } });
    return { ok: true };
  }, { isolationLevel: "Serializable" });
}

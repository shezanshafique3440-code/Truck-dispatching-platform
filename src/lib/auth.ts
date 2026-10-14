import "server-only";
import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { after } from "next/server";
import { headers as requestHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { authConfiguration, authConfigured, resetEmailConfigured } from "@/lib/auth-config";
import { consumeLimit } from "@/lib/throttle";
import { HttpError } from "@/lib/http";
import type { Actor } from "@/lib/access";
import type { Prisma } from "@/generated/prisma/client";
import { company } from "@/config/company";
let instance: ReturnType<typeof createAuth> | undefined;
function createAuth() {
  const config = authConfiguration();
  return betterAuth({
    appName: company.name, baseURL: config.origin, secret: config.secret,
    database: prismaAdapter(getDb(), { provider: "postgresql", transaction: true }),
    trustedOrigins: [config.origin],
    emailAndPassword: {
      enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true, resetPasswordTokenExpiresIn: 1800,
      ...(resetEmailConfigured() ? { sendResetPassword: async ({ user, url }: { user: { id: string; email: string }; url: string }) => {
        after(async () => {
          const current = await getDb().user.findUnique({ where: { id: user.id }, select: { active: true } });
          if (!current?.active) return;
          try {
            const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.MAIL_FROM, to: [user.email], subject: "Reset your team workspace password", text: `Use this link to reset your password: ${url}\nThis link expires in 30 minutes. If you did not request it, ignore this email.` }) });
            if (!response.ok) console.error("Password reset email delivery failed.");
          } catch { console.error("Password reset email delivery failed."); }
        });
      } } : {}),
      onPasswordReset: async ({ user }) => { await getDb().auditEvent.create({ data: { actorId: user.id, action: "AUTH_PASSWORD_RESET", entityType: "user", entityId: user.id } }); },
    },
    user: { additionalFields: { role: { type: "string", defaultValue: "DISPATCHER", input: false }, active: { type: "boolean", defaultValue: true, input: false } } },
    session: { expiresIn: 60 * 60 * 8, disableSessionRefresh: true, cookieCache: { enabled: false } },
    advanced: { useSecureCookies: config.secure, cookiePrefix: "northlane", defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/", secure: config.secure }, ipAddress: { ipAddressHeaders: process.env.TRUSTED_CLIENT_IP_HEADER ? [process.env.TRUSTED_CLIENT_IP_HEADER] : [] } },
    rateLimit: { enabled: true, window: 60, max: 100, customRules: { "/sign-in/email": { window: 60, max: 60 }, "/request-password-reset": { window: 60, max: 20 } }, customStorage: { consume: (key, rule) => consumeLimit(`library:${key}`, rule) } },
    databaseHooks: { session: {
      create: {
        before: async session => { const user = await getDb().user.findUnique({ where: { id: session.userId }, select: { active: true } }); if (!user?.active) throw new APIError("UNAUTHORIZED", { message: "Invalid email or password." }); },
        after: async session => { await getDb().auditEvent.create({ data: { actorId: session.userId, action: "AUTH_LOGIN", entityType: "session", entityId: session.id } }); },
      },
      delete: { after: async session => { await getDb().auditEvent.create({ data: { actorId: session.userId, action: "AUTH_SESSION_REVOKED", entityType: "session", entityId: session.id } }); } },
    } },
    logger: { disabled: true },
  });
}
export function getAuth() { return instance ??= createAuth(); }
export async function currentSession(h: Headers) {
  if (!authConfigured()) return null;
  return getAuth().api.getSession({ headers: h, query: { disableCookieCache: true } });
}
export async function actorForSession(session: NonNullable<Awaited<ReturnType<typeof currentSession>>>, db: Prisma.TransactionClient | ReturnType<typeof getDb>): Promise<Actor> {
  const valid = await db.session.findFirst({ where: { id: session.session.id, userId: session.user.id, expiresAt: { gt: new Date() } } });
  if (!valid) throw new HttpError(401, "Please sign in.");
  const user = await db.user.findUnique({ where: { id: valid.userId }, include: { memberships: { where: { team: { active: true } } }, assignments: { where: { campaign: { team: { active: true } } } } } });
  if (!user?.active) throw new HttpError(401, "Please sign in.");
  return { id: user.id, name: user.name, role: user.role, teamIds: user.memberships.map(m => m.teamId), campaignIds: user.assignments.map(a => a.campaignId) };
}
export async function getCurrentActor(h?: Headers): Promise<Actor | null> {
  const session = await currentSession(h ?? new Headers(await requestHeaders())); if (!session) return null;
  try { return await actorForSession(session, getDb()); } catch (error) { if (error instanceof HttpError && error.status === 401) return null; throw error; }
}
export async function requireActor(): Promise<Actor> { const actor = await getCurrentActor(); if (!actor) redirect("/login"); return actor; }

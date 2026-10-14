import { getAuth, getCurrentActor } from "@/lib/auth";
import { authConfigured, resetEmailConfigured } from "@/lib/auth-config";
import { checkOrigin, readJson, json, errorResponse, HttpError } from "@/lib/http";
import { loginInput, email, password } from "@/lib/validation";
import { consumeLimit, clientBucket } from "@/lib/throttle";
import { z } from "zod";
import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
const allowed = new Set(["sign-in/email", "sign-out", "get-session", "revoke-other-sessions", "request-password-reset", "reset-password", "change-password"]);
const sessionOnly = new Set(["revoke-other-sessions", "change-password"]);
async function handle(request: Request) {
  try {
    if (!authConfigured()) throw new HttpError(503, "Team authentication is not configured yet.");
    const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
    if (!allowed.has(path) && !(request.method === "GET" && path.startsWith("reset-password/"))) throw new HttpError(404, "Endpoint not found.");
    if (request.method === "GET" && !["get-session", "list-sessions"].includes(path) && !path.startsWith("reset-password/")) throw new HttpError(405, "Method not allowed.");
    if (sessionOnly.has(path) && !await getCurrentActor(request.headers)) throw new HttpError(401, "Please sign in.");
    if (path === "get-session") { const actor = await getCurrentActor(request.headers); return json(actor ? { user: { id: actor.id, name: actor.name, role: actor.role } } : null); }
    let body: unknown;
    if (request.method === "POST") {
      checkOrigin(request);
      const bucket = await consumeLimit(`auth-origin:${clientBucket(request.headers)}`, { window: 60, max: 120 });
      if (!bucket.allowed) return json({ error: "Too many requests. Please wait." }, 429);
      body = await readJson(request);
      if (path === "sign-in/email") {
        body = loginInput.parse(body); const parsed = body as z.infer<typeof loginInput>;
        const limit = await consumeLimit(`login-email:${parsed.email}`, { window: 900, max: 5 });
        if (!limit.allowed) return new Response(JSON.stringify({ error: "Too many sign-in attempts. Try again later." }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" } });
      } else if (path === "request-password-reset") {
        if (!resetEmailConfigured()) throw new HttpError(503, "Password reset email is not connected. Contact your administrator.");
        const data = z.object({ email }).strict().parse(body);
        const limit = await consumeLimit(`reset-email:${data.email}`, { window: 900, max: 3 }); if (!limit.allowed) throw new HttpError(429, "Too many reset requests. Please wait.");
        body = { ...data, redirectTo: "/reset-password" };
      } else if (path === "reset-password") {
        if (!resetEmailConfigured()) throw new HttpError(503, "Password reset email is not connected.");
        body = z.object({ token: z.string().min(1).max(512), newPassword: password }).strict().parse(body);
      } else if (path === "change-password") body = { ...z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).strict().parse(body), revokeOtherSessions: true };
      else if (path === "revoke-session") body = z.object({ token: z.string().min(1).max(512) }).strict().parse(body);
      else body = z.object({}).strict().parse(body);
      request = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) });
    }
    const response = await getAuth().handler(request);
    if ((path === "sign-in/email" || path === "change-password") && response.ok) { const data = await response.json(); const outgoing = json(path === "change-password" ? { ok: true } : { user: { id: data.user?.id, name: data.user?.name }, redirect: false }); for (const cookie of response.headers.getSetCookie()) outgoing.headers.append("Set-Cookie", cookie); return outgoing; }
    if (path === "sign-in/email" && !response.ok && response.status !== 429) {
      await getDb().auditEvent.create({ data: { action: "AUTH_LOGIN_FAILED", entityType: "session", metadata: { status: response.status } } });
      return json({ error: "Invalid email or password." }, response.status >= 500 ? 503 : 401);
    }
    const outgoing = new Response(response.body, response); outgoing.headers.set("Cache-Control", "private, no-store"); return outgoing;
  } catch (error) { return errorResponse(error); }
}
export const GET = handle;
export const POST = handle;

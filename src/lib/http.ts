import "server-only";
import { z } from "zod";
import { authConfiguration } from "@/lib/auth-config";
import { isWriteConflict } from "@/lib/database-errors";
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== authConfiguration().origin) throw new HttpError(403, "Request origin is not allowed.");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Cross-site requests are not allowed.");
}
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Use application/json.");
  if (!request.body) throw new HttpError(400, "A request body is required.");
  const reader = request.body.getReader(); let bytes = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 16_384) { await reader.cancel(); throw new HttpError(413, "Request is too large."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError(400, "Invalid JSON."); }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return json({ error: "Check the submitted fields.", fields: [...new Set(error.issues.map(i => i.path[0]).filter(Boolean))] }, 400);
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "P2002") return json({ error: "A record with these details already exists." }, 409);
  if (isWriteConflict(error)) return json({ error: "The record changed during this request. Please retry." }, 409);
  if (code === "P2025") return json({ error: "Record not found." }, 404);
  // Never log request bodies, cookies, password hashes, token URLs or database URLs.
  console.error("Workspace operation failed.", { name: error instanceof Error ? error.name : "Unknown", code: typeof code === "string" ? code : "unclassified" });
  return json({ error: "The service is temporarily unavailable." }, 503);
}

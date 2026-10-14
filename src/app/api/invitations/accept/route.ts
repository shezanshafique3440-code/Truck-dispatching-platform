import { acceptInvitation } from "@/lib/invitations";
import { checkOrigin, readJson, json, errorResponse, HttpError } from "@/lib/http";
import { consumeLimit, clientBucket } from "@/lib/throttle";
export async function POST(request: Request) {
  try { checkOrigin(request); const limit = await consumeLimit(`invite:${clientBucket(request.headers)}`, { window: 60, max: 20 }); if (!limit.allowed) throw new HttpError(429, "Too many requests. Please wait and try again."); return json(await acceptInvitation(await readJson(request))); } catch (error) { return errorResponse(error); }
}

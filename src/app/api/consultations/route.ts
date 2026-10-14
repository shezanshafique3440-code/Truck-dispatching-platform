import { z } from "zod";
import { checkOrigin, errorResponse, HttpError, json, readJson } from "@/lib/http";
import { clientBucket, consumeLimit } from "@/lib/throttle";
import { consultationInput } from "@/lib/lead-validation";
import { saveConsultation } from "@/lib/consultations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const bucket = clientBucket(request.headers);
    const limit = await consumeLimit(`consultation:ip:${bucket}`, { window: 900, max: bucket === "shared-origin" ? 60 : 12 });
    if (!limit.allowed) return Response.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" } });
    const input = consultationInput.parse(await readJson(request));
    if (input.website) throw new HttpError(400, "Please leave the website field empty.");
    const emailLimit = await consumeLimit(`consultation:email:${input.email}`, { window: 3600, max: 3 });
    if (!emailLimit.allowed) return Response.json({ error: "Too many requests for this email. Please try again later." }, { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter), "Cache-Control": "no-store" } });
    const result = await saveConsultation(input);
    return json({ saved: result.saved, notification: result.notification }, result.created ? 201 : 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = z.flattenError(error).fieldErrors;
      return json({ error: "Please check the highlighted fields. Your information has been kept.", fieldErrors }, 400);
    }
    return errorResponse(error);
  }
}

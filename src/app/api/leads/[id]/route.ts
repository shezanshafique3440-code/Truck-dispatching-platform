import { leadDetails, updateLead } from "@/lib/leads";
import { json, checkOrigin, readJson, errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return json(await leadDetails(request.headers, (await context.params).id)); }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { checkOrigin(request); return json(await updateLead(request.headers, (await context.params).id, await readJson(request))); }
  catch (error) { return errorResponse(error); }
}

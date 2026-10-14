import { addLeadNote } from "@/lib/leads";
import { json, checkOrigin, readJson, errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { checkOrigin(request); return json(await addLeadNote(request.headers, (await context.params).id, await readJson(request)), 201); }
  catch (error) { return errorResponse(error); }
}

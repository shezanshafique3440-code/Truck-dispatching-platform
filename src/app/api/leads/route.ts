import { listLeads } from "@/lib/leads";
import { json, errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return json(await listLeads(request.headers, Object.fromEntries(new URL(request.url).searchParams))); }
  catch (error) { return errorResponse(error); }
}

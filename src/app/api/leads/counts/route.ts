import { leadCounts } from "@/lib/leads";
import { json, errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return json(await leadCounts(request.headers)); } catch (error) { return errorResponse(error); }
}

import { importDirectory } from "@/lib/performance-import";
import { errorResponse, json } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { const query = new URL(request.url).searchParams; if ([...query.keys()].some(k => !["campaignId", "page"].includes(k))) return json({ error: "Invalid directory filters." }, 400); return json(await importDirectory(request.headers, query.get("campaignId") ?? "", query.get("page") ?? undefined)); } catch (error) { return errorResponse(error); } }

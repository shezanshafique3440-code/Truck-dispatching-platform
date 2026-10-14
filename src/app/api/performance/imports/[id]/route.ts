import { getPerformanceImport } from "@/lib/performance-import";
import { errorResponse, json } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { try { return json(await getPerformanceImport(request.headers, (await context.params).id, Object.fromEntries(new URL(request.url).searchParams))); } catch (error) { return errorResponse(error); } }

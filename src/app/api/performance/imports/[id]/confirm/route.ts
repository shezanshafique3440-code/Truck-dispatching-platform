import { confirmPerformanceImport } from "@/lib/performance-import";
import { errorResponse, json, checkOrigin, readJson } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { checkOrigin(request); const result = await confirmPerformanceImport(request.headers, (await context.params).id, await readJson(request)); return json(result, "reviewRequired" in result ? 409 : 200); } catch (error) { return errorResponse(error); } }

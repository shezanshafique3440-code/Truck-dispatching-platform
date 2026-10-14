import { previewPerformanceImport } from "@/lib/performance-import";
import { errorResponse, json, checkOrigin, readJson } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { checkOrigin(request); return json(await previewPerformanceImport(request.headers, (await context.params).id, await readJson(request))); } catch (error) { return errorResponse(error); } }

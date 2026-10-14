import { getPerformance, updatePerformance } from "@/lib/performance";
import { checkOrigin, errorResponse, json, readJson } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { try { return json(await getPerformance(request.headers, (await context.params).id)); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { try { checkOrigin(request); return json(await updatePerformance(request.headers, (await context.params).id, await readJson(request))); } catch (error) { return errorResponse(error); } }

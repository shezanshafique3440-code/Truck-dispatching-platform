import { createPerformance, listPerformance } from "@/lib/performance";
import { checkOrigin, errorResponse, json, readJson } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { return json(await listPerformance(request.headers, Object.fromEntries(new URL(request.url).searchParams))); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { checkOrigin(request); return json(await createPerformance(request.headers, await readJson(request)), 201); } catch (error) { return errorResponse(error); } }

import { listPerformanceImports } from "@/lib/performance-import";
import { uploadPerformanceImport } from "@/lib/import-upload";
import { errorResponse, json, checkOrigin } from "@/lib/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) { try { return json(await listPerformanceImports(request.headers, Object.fromEntries(new URL(request.url).searchParams))); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { checkOrigin(request); return json(await uploadPerformanceImport(request), 201); } catch (error) { return errorResponse(error); } }

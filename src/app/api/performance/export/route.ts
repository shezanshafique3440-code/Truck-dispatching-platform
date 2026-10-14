import { exportPerformance } from "@/lib/performance-export";
import { errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { return await exportPerformance(request.headers, Object.fromEntries(new URL(request.url).searchParams)); } catch (error) { return errorResponse(error); } }

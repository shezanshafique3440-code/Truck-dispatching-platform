import { paginatedUsers } from "@/lib/workspace";
import { errorResponse, json } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { return json(await paginatedUsers(request.headers, Object.fromEntries(new URL(request.url).searchParams))); } catch (error) { return errorResponse(error); } }

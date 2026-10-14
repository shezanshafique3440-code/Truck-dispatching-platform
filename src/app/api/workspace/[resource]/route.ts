import { resourceName, listResource, createResource } from "@/lib/workspace";
import { checkOrigin, readJson, json, errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  try { return json(await listResource(request.headers, resourceName((await context.params).resource), Object.fromEntries(new URL(request.url).searchParams))); } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try { checkOrigin(request); return json(await createResource(request.headers, resourceName((await context.params).resource), await readJson(request)), 201); } catch (error) { return errorResponse(error); }
}

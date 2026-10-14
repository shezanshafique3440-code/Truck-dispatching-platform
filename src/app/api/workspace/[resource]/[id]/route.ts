import { resourceName, getResource, updateResource } from "@/lib/workspace";
import { checkOrigin, readJson, json, errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string; id: string }> };
export async function GET(request: Request, context: Context) {
  try { const { resource, id } = await context.params; return json(await getResource(request.headers, resourceName(resource), id)); } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try { checkOrigin(request); const { resource, id } = await context.params; return json(await updateResource(request.headers, resourceName(resource), id, await readJson(request))); } catch (error) { return errorResponse(error); }
}

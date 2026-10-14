import { resourceName, exportResource } from "@/lib/workspace";
import { errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
function cell(value: unknown) { let text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); if (/^(\s*[=+@\-]|[\t\r\n])/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; }
export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const resource = resourceName((await context.params).resource);
    const rows = await exportResource(request.headers, resource, Object.fromEntries(new URL(request.url).searchParams));
    const records = JSON.parse(JSON.stringify(rows)) as Record<string, unknown>[];
    const keys = records.length ? Object.keys(records[0]) : ["id"];
    const csv = [keys.map(cell).join(","), ...records.map(row => keys.map(key => cell(row[key])).join(","))].join("\r\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${resource}.csv"`, "Cache-Control": "private, no-store", "X-Export-Row-Limit": "1000" } });
  } catch (error) { return errorResponse(error); }
}

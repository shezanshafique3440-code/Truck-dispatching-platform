import { authorizedOperation } from "@/lib/authorized-operation";
import { importColumns } from "@/lib/import-contract";
import { spreadsheetResponse } from "@/lib/spreadsheet-export";
import { errorResponse } from "@/lib/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await authorizedOperation(request.headers, false, async () => true);
    const { format } = z.object({ format: z.enum(["csv", "xlsx"]).default("csv") }).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    return spreadsheetResponse(importColumns.map(c => c.key), [], format, "performance-template", ["Complete the Performance worksheet only. Select the matching campaign when uploading.", "One dispatcher + campaign + work date is allowed. Existing records are never overwritten.", "Every imported record starts Draft and needs submission and Manager/Admin approval before affecting totals.", "Supply a stable dispatcher ID or verified account email, never a name alone. Use the assigned-dispatcher directory.", "Use literal values; formulas, macros and external links are unsupported. Amounts use plain decimals, without symbols, grouping or scientific notation.", ...importColumns.map(c => `${c.key}: ${c.description}`)]);
  } catch (error) { return errorResponse(error); }
}

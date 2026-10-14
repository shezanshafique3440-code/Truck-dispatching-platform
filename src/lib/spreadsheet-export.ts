import writeExcelFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
export function spreadsheetText(value: unknown) {
  let text = value == null ? "" : String(value);
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "");
  if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return text;
}
export function csvDocument(columns: readonly string[], rows: Record<string, unknown>[]) {
  const cell = (value: unknown) => `"${spreadsheetText(value).replaceAll('"', '""')}"`;
  return "\uFEFF" + [columns.map(cell).join(","), ...rows.map(row => columns.map(key => cell(row[key])).join(","))].join("\r\n");
}
export async function spreadsheetResponse(columns: readonly string[], rows: Record<string, unknown>[], format: "csv" | "xlsx", filename: string, instructions?: string[]) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff", "X-Export-Row-Count": String(rows.length), "Content-Disposition": `attachment; filename="${filename}.${format}"` };
  if (format === "csv") return new Response(csvDocument(columns, rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  const sheetData: SheetData = [columns.map(value => ({ type: String, value, fontWeight: "bold" as const })), ...rows.map(row => columns.map(key => ({ type: String, value: spreadsheetText(row[key]) })))];
  const options = { sheet: filename === "performance-template" ? "Performance" : "Report", columns: columns.map(key => ({ width: Math.max(18, Math.min(36, key.length + 3)) })), stickyRowsCount: 1 };
  const workbook = instructions ? writeExcelFile([{ data: sheetData, ...options }, { data: instructions.map(value => [{ type: String, value }]), sheet: "Instructions", columns: [{ width: 100 }] }]) : writeExcelFile(sheetData, options);
  const bytes = await workbook.toBuffer();
  return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
}

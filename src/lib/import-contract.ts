import { z } from "zod";
export const importColumns = [
  { key: "work_date", label: "Work date", description: "Required YYYY-MM-DD campaign-local date." },
  { key: "campaign_id", label: "Campaign ID", description: "Optional cell; if supplied, must match the campaign selected for this batch." },
  { key: "dispatcher_id", label: "Dispatcher ID", description: "Stable assigned user ID. Supply this or a verified dispatcher email." },
  { key: "dispatcher_email", label: "Verified dispatcher email", description: "Only accounts with verified email qualify. If both identities are supplied, they must match." },
  { key: "calls_made", label: "Calls made", description: "Required whole number, 0–1,000,000." },
  { key: "follow_ups_completed", label: "Follow-ups completed", description: "Required whole number, 0–1,000,000." },
  { key: "qualified_leads", label: "Qualified leads", description: "Required whole number, 0–1,000,000." },
  { key: "carriers_signed", label: "Carriers signed", description: "Required whole number, 0–1,000,000." },
  { key: "loads_booked", label: "Loads booked", description: "Whole number when campaign tracks loads; otherwise leave blank." },
  { key: "dispatch_fees", label: "Dispatch fees earned", description: "Required nonnegative decimal, at most 12 whole digits and 2 decimal places." },
  { key: "refunds", label: "Refunds", description: "Required nonnegative decimal; use 0 when none." },
  { key: "adjustments", label: "Adjustments", description: "Required signed decimal; use 0 when none." },
  { key: "currency", label: "Currency", description: "Required supported three-letter code. All amounts in a row use this currency." },
  { key: "gross_freight_revenue", label: "Gross freight revenue", description: "Optional nonnegative decimal; kept separate from dispatch fees." },
  { key: "notes", label: "Private notes", description: "Optional plain text, at most 2,000 characters. Formulas are unsupported." },
] as const;
export type ImportColumn = typeof importColumns[number]["key"];
export function importFieldLabel(field: string) { return importColumns.find(c => c.key === field)?.label ?? (field === "row" ? "Row" : field); }
export type ColumnMapping = Partial<Record<ImportColumn, number | null>>;
export type ImportIssue = { field: string; message: string };
export type RawImportRow = { rowNumber: number; cells: string[]; parseErrors: ImportIssue[] };
export const importLimits = { bytes: 2 * 1024 * 1024, rows: 1000, columns: 32, expandedBytes: 8 * 1024 * 1024, archiveEntries: 100, pageSize: 20, expiresHours: 24 } as const;
export const mappingInput = z.object(Object.fromEntries(importColumns.map(c => [c.key, z.number().int().min(0).max(importLimits.columns - 1).nullable().optional()])) as Record<ImportColumn, z.ZodOptional<z.ZodNullable<z.ZodNumber>>>).strict();
export const previewInput = z.object({ version: z.number().int().min(1), mapping: mappingInput }).strict();
export const confirmInput = z.object({ version: z.number().int().min(1), confirm: z.literal(true) }).strict();
export const importPageQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), rows: z.enum(["all", "valid", "errors"]).default("all") }).strict();
export function inferMapping(headers: string[]): ColumnMapping {
  const aliases: Record<string, ImportColumn> = { date: "work_date", loads: "loads_booked", gross_revenue: "gross_freight_revenue", grossrevenue: "gross_freight_revenue", callsmade: "calls_made", followupscompleted: "follow_ups_completed", qualifiedleads: "qualified_leads", carrierssigned: "carriers_signed", dispatchfees: "dispatch_fees", dispatcherid: "dispatcher_id", campaignid: "campaign_id" };
  const mapping: ColumnMapping = {};
  headers.forEach((header, index) => { const normalized = header.trim().toLowerCase().replace(/[\s-]+/g, "_"); const key = aliases[normalized] ?? normalized; if (importColumns.some(c => c.key === key)) mapping[key as ImportColumn] = index; });
  return mapping;
}
export function mappingIssues(mapping: ColumnMapping, width: number): ImportIssue[] {
  const issues: ImportIssue[] = []; const used = new Set<number>();
  for (const [key, index] of Object.entries(mapping)) if (index !== null && index !== undefined) {
    if (index >= width) issues.push({ field: key, message: "This column is missing from the file." });
    if (used.has(index)) issues.push({ field: key, message: "Map each source column to only one field." }); used.add(index);
  }
  const required: ImportColumn[] = ["work_date", "calls_made", "follow_ups_completed", "qualified_leads", "carriers_signed", "dispatch_fees", "refunds", "adjustments", "currency"];
  if (mapping.dispatcher_id == null && mapping.dispatcher_email == null) issues.push({ field: "dispatcher_id", message: "Map a stable dispatcher ID or verified email column." });
  for (const key of required) if (mapping[key] == null) issues.push({ field: key, message: "Map this required field." });
  return issues;
}
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => `${JSON.stringify(key)}:${stableStringify(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

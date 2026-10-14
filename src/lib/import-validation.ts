import { performanceInput, performanceMetrics } from "@/lib/performance-validation";
import { fromCents, toCents } from "@/lib/performance-math";
import type { ColumnMapping, ImportColumn, ImportIssue, RawImportRow } from "@/lib/import-contract";
export type ImportedDaily = { dispatcherId: string; campaignId: string; date: string; currency: string; callsMade: number; followUpsCompleted: number; qualifiedLeads: number; carriersSigned: number; loads: number | null; dispatchFees: string; refunds: string; adjustments: string; grossRevenue: string | null; notes: string | null };
export function mappedValue(row: RawImportRow, mapping: ColumnMapping, key: ImportColumn) { const index = mapping[key]; return index == null ? "" : (row.cells[index] ?? "").trim(); }
export function parseImportMetrics(row: RawImportRow, mapping: ColumnMapping, campaign: { id: string; tracksLoads: boolean }, dispatcherId: string) {
  const issues: ImportIssue[] = [...row.parseErrors];
  const text = (key: ImportColumn) => mappedValue(row, mapping, key);
  const count = (key: ImportColumn) => /^\d{1,7}$/.test(text(key)) ? Number(text(key)) : Number.NaN;
  if (text("campaign_id") && text("campaign_id") !== campaign.id) issues.push({ field: "campaign_id", message: "This row belongs to a different campaign than the selected batch." });
  const input = { campaignId: campaign.id, dispatcherId, date: text("work_date"), currency: text("currency"), callsMade: count("calls_made"), followUpsCompleted: count("follow_ups_completed"), qualifiedLeads: count("qualified_leads"), carriersSigned: count("carriers_signed"), loads: text("loads_booked") ? count("loads_booked") : null, dispatchFees: text("dispatch_fees"), refunds: text("refunds"), adjustments: text("adjustments"), grossRevenue: text("gross_freight_revenue") || null, notes: text("notes") || null };
  if (input.date.startsWith("0000-")) issues.push({ field: "work_date", message: "Work date must use a valid year from 0001 to 9999." });
  const schema = performanceInput.merge(performanceMetrics);
  const parsed = schema.safeParse(input);
  const fieldNames: Record<string, ImportColumn> = { date: "work_date", dispatcherId: "dispatcher_id", campaignId: "campaign_id", callsMade: "calls_made", followUpsCompleted: "follow_ups_completed", qualifiedLeads: "qualified_leads", carriersSigned: "carriers_signed", loads: "loads_booked", dispatchFees: "dispatch_fees", grossRevenue: "gross_freight_revenue" };
  if (!parsed.success) for (const error of parsed.error.issues) {
    const key = String(error.path[0] ?? "row");
    const message = ["callsMade", "followUpsCompleted", "qualifiedLeads", "carriersSigned", "loads"].includes(key) ? "Enter a whole number from 0 to 1,000,000." : key === "date" ? "Use a real calendar date in YYYY-MM-DD format." : key === "notes" ? "Keep private notes within 2,000 characters." : error.message;
    issues.push({ field: fieldNames[key] ?? key, message });
  }
  if (campaign.tracksLoads && input.loads === null) issues.push({ field: "loads_booked", message: "Enter loads booked for this campaign." });
  if (!campaign.tracksLoads && input.loads !== null) issues.push({ field: "loads_booked", message: "Leave loads blank because this campaign does not track loads." });
  if (!parsed.success || issues.length) return { errors: issues, normalized: null };
  const value = parsed.data as ImportedDaily;
  for (const key of ["dispatchFees", "refunds", "adjustments"] as const) value[key] = fromCents(toCents(value[key]));
  if (value.grossRevenue !== null) value.grossRevenue = fromCents(toCents(value.grossRevenue));
  return { errors: issues, normalized: value };
}
export function dailyKey(dispatcherId: string, date: string) { return `${dispatcherId}\u0000${date}`; }

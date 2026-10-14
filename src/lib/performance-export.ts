import "server-only";
import { z } from "zod";
import { authorizedOperation } from "@/lib/authorized-operation";
import { performanceFilter, performanceSelect } from "@/lib/performance-records";
import { cleanQuery, performanceListQuery } from "@/lib/performance-validation";
import { performanceReport } from "@/lib/performance-report";
import { HttpError } from "@/lib/http";
import { netFees } from "@/lib/performance-math";
import { importColumns } from "@/lib/import-contract";
import { spreadsheetResponse } from "@/lib/spreadsheet-export";
export const exportLimit = 5000;
const formatInput = z.enum(["csv", "xlsx"]).default("csv");
export async function exportPerformance(headers: Headers, raw: Record<string, string>) {
  const { format: rawFormat, ...filters } = raw; const format = formatInput.parse(rawFormat);
  const rows = await authorizedOperation(headers, false, async (tx, actor) => {
    const query = performanceListQuery.parse(cleanQuery(filters)); const where = performanceFilter(actor, query);
    const total = await tx.performanceEntry.count({ where });
    if (total > exportLimit) throw new HttpError(422, "More than 5,000 records match. Narrow the dates, campaign, dispatcher or state before exporting.");
    const entries = await tx.performanceEntry.findMany({ where, orderBy: [{ date: "desc" }, { id: "desc" }], select: { ...performanceSelect, importBatchId: true, importRow: { select: { rowNumber: true } }, importBatch: { select: { importedById: true, committedAt: true } } } });
    return entries.map(r => ({ work_date: r.date.toISOString().slice(0, 10), campaign_id: r.campaignId, dispatcher_id: r.dispatcherId, dispatcher_email: "", calls_made: r.callsMade, follow_ups_completed: r.followUpsCompleted, qualified_leads: r.qualifiedLeads, carriers_signed: r.carriersSigned, loads_booked: r.loads, dispatch_fees: r.dispatchFees.toFixed(2), refunds: r.refunds.toFixed(2), adjustments: r.adjustments.toFixed(2), currency: r.currency, gross_freight_revenue: r.grossRevenue?.toFixed(2), notes: r.notes, record_id: r.id, dispatcher_name: r.dispatcher.name, campaign_name: r.campaign?.name, team_id: r.teamId, team_name: r.team?.name, work_timezone: r.workTimezone, state: r.state, net_dispatch_fees: netFees(r.dispatchFees.toFixed(2), r.refunds.toFixed(2), r.adjustments.toFixed(2)), archived_at: r.archivedAt?.toISOString(), source: r.source, import_batch_id: r.importBatchId, imported_by_id: r.importBatch?.importedById, imported_at: r.importBatch?.committedAt?.toISOString(), import_row_number: r.importRow?.rowNumber, version: r.version }));
  });
  const columns = [...importColumns.map(c => c.key), "record_id", "dispatcher_name", "campaign_name", "team_id", "team_name", "work_timezone", "state", "net_dispatch_fees", "archived_at", "source", "import_batch_id", "imported_by_id", "imported_at", "import_row_number", "version"];
  return spreadsheetResponse(columns, rows, format, "performance-records");
}
export async function exportLeaderboard(headers: Headers, raw: Record<string, string>) {
  const { format: rawFormat, ...filters } = raw; const format = formatInput.parse(rawFormat);
  // Same service and current live scope as cards/charts; page parameters never limit the report export.
  const report = await performanceReport(headers, filters);
  if (report.leaderboard.length > exportLimit) throw new HttpError(422, "More than 5,000 dispatchers match. Narrow the report scope before exporting.");
  const columns = ["rank", "dispatcher_id", "dispatcher_name", "active_account", "approved_records", "calls_made", "follow_ups_completed", "qualified_leads", "carriers_signed", "loads_booked", "dispatch_fees", "refunds", "adjustments", "net_dispatch_fees", "currency", "conversion_rate_percent", "gross_freight_revenue", "gross_revenue_records", "period", "anchor", "campaign_filter", "team_filter", "dispatcher_filter", "campaign_local_periods"];
  const rows = report.leaderboard.map(r => ({ rank: r.rank, dispatcher_id: r.dispatcherId, dispatcher_name: r.name, active_account: r.active, approved_records: r.records, calls_made: r.callsMade, follow_ups_completed: r.followUpsCompleted, qualified_leads: r.qualifiedLeads, carriers_signed: r.carriersSigned, loads_booked: r.loads, dispatch_fees: r.dispatchFees, refunds: r.refunds, adjustments: r.adjustments, net_dispatch_fees: r.netFees, currency: report.currency, conversion_rate_percent: r.conversionRate === null ? "N/A" : r.conversionRate.toFixed(4), gross_freight_revenue: r.grossRevenue, gross_revenue_records: r.grossRecords, period: report.query.period, anchor: report.query.anchor, campaign_filter: report.query.campaignId, team_filter: report.query.teamId, dispatcher_filter: report.query.dispatcherId, campaign_local_periods: JSON.stringify(report.periods.map(p => ({ campaignId: p.id, timezone: p.timezone, from: p.from, to: p.to }))) }));
  return spreadsheetResponse(columns, rows, format, "dispatcher-leaderboard", ["Approved, active records only; one currency per report.", "Rank: approved carriers signed, then exact net dispatch fees. Exact ties share competition ranks.", "Conversion: carriers signed / qualified leads * 100; N/A when the denominator is zero. This is an activity ratio.", "Gross freight revenue stays separate from dispatch fees and rankings."]);
}

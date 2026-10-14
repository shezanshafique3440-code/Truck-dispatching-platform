import { conversionRate, fromCents, rankRows, toCents } from "@/lib/performance-math";
export type ApprovedGroup = { dispatcherId: string; teamId: string | null; date: string; records: number; grossRecords: number; callsMade: number; followUpsCompleted: number; qualifiedLeads: number; carriersSigned: number; loads: number; dispatchFees: string; refunds: string; adjustments: string; grossRevenue: string };
function blank() { return { records: 0, grossRecords: 0, callsMade: 0, followUpsCompleted: 0, qualifiedLeads: 0, carriersSigned: 0, loads: 0, dispatchFees: BigInt(0), refunds: BigInt(0), adjustments: BigInt(0), grossRevenue: BigInt(0) }; }
type Totals = ReturnType<typeof blank>;
function add(t: Totals, row: ApprovedGroup) {
  for (const key of ["records", "grossRecords", "callsMade", "followUpsCompleted", "qualifiedLeads", "carriersSigned", "loads"] as const) t[key] += row[key];
  for (const key of ["dispatchFees", "refunds", "adjustments", "grossRevenue"] as const) t[key] += toCents(row[key]);
}
function serialize(t: Totals) { return { ...t, dispatchFees: fromCents(t.dispatchFees), refunds: fromCents(t.refunds), adjustments: fromCents(t.adjustments), netFees: fromCents(t.dispatchFees - t.refunds + t.adjustments), grossRevenue: fromCents(t.grossRevenue), conversionRate: conversionRate(t.carriersSigned, t.qualifiedLeads) }; }
// This function receives only rows already aggregated and currency/scoped/approval-filtered in PostgreSQL.
export function summarizeApproved(groups: ApprovedGroup[]) {
  const total = blank(); const dispatchers = new Map<string, Totals>(); const teams = new Map<string, Totals>(); const days = new Map<string, Totals>();
  for (const row of groups) {
    add(total, row);
    for (const [map, key] of [[dispatchers, row.dispatcherId], [teams, row.teamId ?? "legacy"], [days, row.date]] as const) { const t = map.get(key) ?? blank(); add(t, row); map.set(key, t); }
  }
  return { totals: serialize(total), leaderboard: rankRows([...dispatchers].map(([dispatcherId, t]) => ({ dispatcherId, ...serialize(t) }))), teams: [...teams].map(([teamId, t]) => ({ teamId, ...serialize(t) })).sort((a, b) => b.carriersSigned - a.carriersSigned || a.teamId.localeCompare(b.teamId)), trend: [...days].map(([date, t]) => ({ date, ...serialize(t) })).sort((a, b) => a.date.localeCompare(b.date)) };
}

import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { authorizedOperation } from "@/lib/authorized-operation";
import { campaignScope, performanceScope, teamScope } from "@/lib/access";
import { cleanQuery, reportQuery } from "@/lib/performance-validation";
import { datesBetween, localDate, periodBounds } from "@/lib/performance-math";
import { summarizeApproved } from "@/lib/performance-summary";

export async function performanceReport(headers: Headers, raw: Record<string, string>, now = new Date()) {
  return authorizedOperation(headers, false, async (tx, actor) => {
    const query = reportQuery.parse(cleanQuery(raw));
    // Owners retain self-only history even after a campaign/membership is removed.
    const campaigns = await tx.campaign.findMany({ where: { AND: [actor.role === "DISPATCHER" ? { OR: [campaignScope(actor), { performance: { some: { dispatcherId: actor.id } } }] } : campaignScope(actor), ...(query.campaignId ? [{ id: query.campaignId }] : []), ...(query.teamId ? [{ teamId: query.teamId }] : [])] }, select: { id: true, name: true, timezone: true, teamId: true }, orderBy: { name: "asc" } });
    const periods = campaigns.map(c => ({ ...c, ...periodBounds(query.period, query.anchor ?? localDate(c.timezone, now)) }));
    const where: Prisma.PerformanceEntryWhereInput = { AND: [performanceScope(actor), { state: "APPROVED", archivedAt: null, currency: query.currency }, ...(query.teamId ? [{ teamId: query.teamId }] : []), ...(query.dispatcherId ? [{ dispatcherId: query.dispatcherId }] : []), periods.length ? { OR: periods.map(p => ({ campaignId: p.id, date: { gte: new Date(`${p.from}T00:00:00Z`), lte: new Date(`${p.to}T00:00:00Z`) } })) } : { id: { in: [] } }] };
    const grouped = await tx.performanceEntry.groupBy({ by: ["dispatcherId", "teamId", "date"], where, _count: { _all: true, grossRevenue: true }, _sum: { callsMade: true, followUpsCompleted: true, qualifiedLeads: true, carriersSigned: true, loads: true, dispatchFees: true, refunds: true, adjustments: true, grossRevenue: true } });
    const summary = summarizeApproved(grouped.map(g => ({ dispatcherId: g.dispatcherId, teamId: g.teamId, date: g.date.toISOString().slice(0, 10), records: g._count._all, grossRecords: g._count.grossRevenue, callsMade: g._sum.callsMade ?? 0, followUpsCompleted: g._sum.followUpsCompleted ?? 0, qualifiedLeads: g._sum.qualifiedLeads ?? 0, carriersSigned: g._sum.carriersSigned ?? 0, loads: g._sum.loads ?? 0, dispatchFees: g._sum.dispatchFees?.toFixed(2) ?? "0.00", refunds: g._sum.refunds?.toFixed(2) ?? "0.00", adjustments: g._sum.adjustments?.toFixed(2) ?? "0.00", grossRevenue: g._sum.grossRevenue?.toFixed(2) ?? "0.00" })));
    const names = await tx.user.findMany({ where: { id: { in: summary.leaderboard.map(r => r.dispatcherId) } }, select: { id: true, name: true, active: true } });
    const teams = await tx.team.findMany({ where: { id: { in: summary.teams.map(t => t.teamId) } }, select: { id: true, name: true } });
    const from = periods.map(p => p.from).sort()[0]; const to = periods.map(p => p.to).sort().at(-1);
    const empty = summarizeApproved([]).totals;
    return { ...summary, currency: query.currency, query, periods, leaderboard: summary.leaderboard.map(row => ({ ...row, name: names.find(n => n.id === row.dispatcherId)?.name ?? "Former dispatcher", active: names.find(n => n.id === row.dispatcherId)?.active ?? false })), teams: summary.teams.map(row => ({ ...row, name: teams.find(t => t.id === row.teamId)?.name ?? "Legacy team" })), trend: from && to ? datesBetween(from, to).map(date => summary.trend.find(row => row.date === date) ?? { date, ...empty }) : [], scope: actor.role === "DISPATCHER" ? "Your approved records only" : actor.role === "MANAGER" ? "Your assigned teams and campaigns" : "All permitted company records" };
  });
}
export async function reportOptions(headers: Headers) {
  return authorizedOperation(headers, false, async (tx, actor) => {
    const campaigns = await tx.campaign.findMany({ where: actor.role === "DISPATCHER" ? { OR: [campaignScope(actor), { performance: { some: { dispatcherId: actor.id } } }] } : campaignScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true, timezone: true, teamId: true } });
    const teams = await tx.team.findMany({ where: actor.role === "DISPATCHER" ? { OR: [teamScope(actor), { performance: { some: { dispatcherId: actor.id } } }] } : teamScope(actor), select: { id: true, name: true }, orderBy: { name: "asc" } });
    const currencies = await tx.performanceEntry.findMany({ where: performanceScope(actor), distinct: ["currency"], select: { currency: true } });
    return { campaigns, teams, currencies: [...new Set(["USD", "CAD", "EUR", "GBP", ...currencies.map(c => c.currency)])].sort() };
  });
}

import { describe, expect, it } from "vitest";
import { conversionRate, formatMoney, localDate, netFees, periodBounds, rankRows, toCents, fromCents } from "./performance-math";
import { summarizeApproved, type ApprovedGroup } from "./performance-summary";
const row: ApprovedGroup = { dispatcherId: "a", teamId: "team-a", date: "2026-10-13", records: 1, grossRecords: 1, callsMade: 10, followUpsCompleted: 3, qualifiedLeads: 4, carriersSigned: 2, loads: 1, dispatchFees: "0.10", refunds: "0.00", adjustments: "0.00", grossRevenue: "1000.00" };
describe("decimal-safe approved performance calculations", () => {
  it("adds cents exactly and keeps gross freight revenue outside net dispatch fees", () => {
    const totals = summarizeApproved([row, { ...row, dispatchFees: "0.20", grossRevenue: "2000.00" }]).totals;
    expect(totals.netFees).toBe("0.30"); expect(totals.grossRevenue).toBe("3000.00"); expect(totals.carriersSigned).toBe(4); expect(totals.conversionRate).toBe(50);
  });
  it("keeps a one-cent difference beyond floating-point safe cents", () => {
    const cents = toCents("9999999999999999.99"); expect(fromCents(cents + BigInt(1))).toBe("10000000000000000.00"); expect(formatMoney("9999999999999999.99", "USD")).toBe("USD 9,999,999,999,999,999.99");
  });
  it("supports refunds exceeding fees and signed adjustments without clamping", () => { expect(netFees("10.00", "12.00", "-0.01")).toBe("-2.01"); expect(netFees("10", "2", "3.50")).toBe("11.50"); });
  it("returns N/A for zero qualification and permits an activity ratio above 100%", () => { expect(conversionRate(3, 0)).toBeNull(); expect(conversionRate(3, 2)).toBe(150); });
  it("uses carriers first, exact net fees second and competition ranks for ties", () => {
    const ranked = rankRows([{ dispatcherId: "z", carriersSigned: 3, netFees: "9999" }, { dispatcherId: "b", carriersSigned: 4, netFees: "0.10" }, { dispatcherId: "a", carriersSigned: 4, netFees: "0.10" }, { dispatcherId: "c", carriersSigned: 4, netFees: "0.09" }]);
    expect(ranked.map(r => [r.dispatcherId, r.rank])).toEqual([["a", 1], ["b", 1], ["c", 3], ["z", 4]]);
  });
  it("groups teams and daily trends from the full supplied approved aggregate", () => {
    const report = summarizeApproved([row, { ...row, teamId: "team-b", dispatcherId: "b", date: "2026-10-14", dispatchFees: "0.20" }]);
    expect(report.teams).toHaveLength(2); expect(report.trend.map(r => r.date)).toEqual(["2026-10-13", "2026-10-14"]); expect(report.totals.netFees).toBe("0.30");
  });
  it("returns clear zero totals and an empty leaderboard without records", () => { const report = summarizeApproved([]); expect(report.totals.netFees).toBe("0.00"); expect(report.totals.conversionRate).toBeNull(); expect(report.leaderboard).toEqual([]); });
});
describe("campaign-local calendar boundaries", () => {
  it("uses the campaign day across midnight and month boundaries", () => {
    const now = new Date("2026-11-01T00:30:00Z"); expect(localDate("America/New_York", now)).toBe("2026-10-31"); expect(localDate("Asia/Karachi", now)).toBe("2026-11-01");
  });
  it("calculates Monday-based weeks across year boundaries", () => { expect(periodBounds("weekly", "2027-01-01")).toEqual({ from: "2026-12-28", to: "2027-01-03" }); });
  it("handles leap months and daylight-saving dates as civil work dates", () => {
    expect(periodBounds("monthly", "2028-02-15")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(periodBounds("daily", "2026-11-01")).toEqual({ from: "2026-11-01", to: "2026-11-01" });
    expect(localDate("America/New_York", new Date("2026-11-01T05:30:00Z"))).toBe(localDate("America/New_York", new Date("2026-11-01T06:30:00Z")));
  });
});

import { describe, expect, it } from "vitest";
import { campaignInput } from "./validation";
import { performanceInput, performanceAction, reportQuery } from "./performance-validation";
const base = { campaignId: "campaign", date: "2026-10-13", currency: "USD", callsMade: 10, followUpsCompleted: 2, qualifiedLeads: 3, carriersSigned: 1, loads: 2, dispatchFees: "0.10", refunds: "0.00", adjustments: "-0.05", grossRevenue: "100.00", notes: null };
describe("performance server validation", () => {
  it("requires a campaign and rejects approval/role/source injection into draft creation", () => {
    expect(performanceInput.safeParse({ ...base, campaignId: null }).success).toBe(false);
    for (const field of ["role", "state", "approvedById", "approvedAt", "source", "workTimezone"]) expect(performanceInput.safeParse({ ...base, [field]: "tampered" }).success).toBe(false);
  });
  it("rejects fractional/negative activity counts and floating-point money inputs", () => {
    for (const patch of [{ carriersSigned: -1 }, { callsMade: 1.5 }, { dispatchFees: 0.1 }, { refunds: "-0.01" }, { adjustments: "1.001" }, { currency: "ZZQ" }]) expect(performanceInput.safeParse({ ...base, ...patch }).success).toBe(false);
  });
  it("requires action/version and a reason for an approved correction", () => {
    expect(performanceAction.safeParse({ action: "correct", version: 1, changes: { dispatchFees: "10.00" } }).success).toBe(false);
    expect(performanceAction.safeParse({ action: "approve" }).success).toBe(false);
    expect(performanceAction.safeParse({ loads: 5 }).success).toBe(false);
    expect(performanceAction.parse({ action: "correct", version: 2, changes: { adjustments: "-1.00" }, reason: "Correct recorded refund adjustment." }).action).toBe("correct");
  });
  it("keeps approved identity/date/currency fixed while allowing draft changes", () => {
    expect(performanceAction.safeParse({ action: "correct", version: 1, changes: { currency: "CAD" }, reason: "Attempt to relabel recorded currency." }).success).toBe(false);
    expect(performanceAction.safeParse({ action: "saveDraft", version: 1, changes: { currency: "CAD", date: "2026-10-12" } }).success).toBe(true);
  });
  it("requires an explicit report currency and a supported campaign timezone", () => {
    expect(reportQuery.safeParse({ period: "monthly" }).success).toBe(false);
    expect(campaignInput.safeParse({ name: "Campaign", teamId: "team", timezone: "Invalid/Zone" }).success).toBe(false);
    expect(campaignInput.parse({ name: "Campaign", teamId: "team", timezone: "America/New_York", tracksLoads: false }).tracksLoads).toBe(false);
  });
});

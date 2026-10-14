import { performanceInput } from "./performance-validation";
import { describe, expect, it } from "vitest";
import { acceptInviteInput, userUpdate } from "./validation";
describe("server input validation", () => {
  it("rejects unexpected identity and role fields on performance submissions", () => {
    expect(performanceInput.safeParse({ teamId: "a", campaignId: "campaign", date: "2026-01-01", loads: 1, grossRevenue: "100.00", currency: "USD", role: "ADMIN" }).success).toBe(false);
  });
  it("rejects invalid calendar dates, negative values and floating money", () => {
    const base = { teamId: "a", campaignId: "campaign", date: "2026-01-01", loads: 1, grossRevenue: "100.00", currency: "USD" };
    for (const invalid of [{ date: "2026-02-30" }, { loads: -1 }, { grossRevenue: 100.1 }, { grossRevenue: "-1" }, { currency: "ZZQ" }]) expect(performanceInput.safeParse({ ...base, ...invalid }).success).toBe(false);
  });
  it("requires a strong invitation password and never accepts a chosen role", () => {
    const base = { token: "a".repeat(64), email: "person@example.invalid", name: "Test person", password: "a-long-test-passphrase" };
    expect(acceptInviteInput.safeParse(base).success).toBe(true);
    expect(acceptInviteInput.safeParse({ ...base, role: "ADMIN" }).success).toBe(false);
    expect(acceptInviteInput.safeParse({ ...base, password: "short" }).success).toBe(false);
  });
  it("rejects password and secret fields on account management", () => { expect(userUpdate.safeParse({ active: false, password: "anything" }).success).toBe(false); });
});

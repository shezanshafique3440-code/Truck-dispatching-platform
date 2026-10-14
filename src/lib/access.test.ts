import { describe, expect, it } from "vitest";
import { campaignScope, leadScope, performanceScope, teamScope, type Actor } from "./access";
const actor: Actor = { id: "dispatcher-a", name: "Test actor", role: "DISPATCHER", teamIds: ["team-a"], campaignIds: ["campaign-a"] };
describe("membership and assignment authorization", () => {
  it("gives administrators company-wide record scopes", () => {
    const admin = { ...actor, role: "ADMIN" as const };
    expect(teamScope(admin)).toEqual({}); expect(campaignScope(admin)).toEqual({}); expect(leadScope(admin)).toEqual({}); expect(performanceScope(admin)).toEqual({});
  });
  it("requires both team membership and direct campaign assignment", () => {
    expect(campaignScope({ ...actor, role: "MANAGER" })).toEqual({ id: { in: ["campaign-a"] }, teamId: { in: ["team-a"] }, team: { active: true } });
  });
  it("limits dispatcher lead reads to personally assigned active-team leads and permitted campaigns", () => { expect(leadScope(actor)).toEqual({ teamId: { in: actor.teamIds }, team: { active: true }, OR: [{ campaignId: null }, { campaign: campaignScope(actor) }], assignedToId: actor.id }); });
  it("excludes untriaged leads from manager access", () => { expect(leadScope({ ...actor, role: "MANAGER" })).toEqual({ teamId: { in: actor.teamIds }, team: { active: true }, OR: [{ campaignId: null }, { campaign: campaignScope({ ...actor, role: "MANAGER" }) }] }); });
  it("limits dispatchers to their own historical performance", () => { expect(performanceScope(actor)).toEqual({ dispatcherId: actor.id }); });
  it("limits managers to their assigned reporting teams and campaigns", () => {
    expect(performanceScope({ ...actor, role: "MANAGER" })).toEqual({ teamId: { in: ["team-a"] }, OR: [{ campaignId: null }, { campaignId: { in: ["campaign-a"] } }] });
  });
  it("does not expand an unassigned manager's scope", () => { expect(teamScope({ ...actor, role: "MANAGER", teamIds: [] })).toEqual({ id: { in: [] }, active: true }); });
});

import { describe, expect, it } from "vitest";
import { consultationInput, leadWorkflowUpdate } from "./lead-validation";
const valid = { requestId: "086d0564-a748-4d4e-a1f0-88d9a5c90203", contactName: " Test Contact ", companyName: " Test Carrier ", email: " contact@example.invalid ", phone: "+1 (202) 555-0100", equipmentType: "dry-van", fleetSize: 2, preferredContactMethod: "EMAIL", message: "Preferred lanes and scheduling details." };
describe("public consultation validation", () => {
  it("normalizes contact fields without changing the public message into a private note", () => {
    const value = consultationInput.parse(valid); expect(value.contactName).toBe("Test Contact"); expect(value.email).toBe("contact@example.invalid"); expect(value).not.toHaveProperty("notes");
  });
  it("rejects IDs, statuses and private notes injected into public submissions", () => {
    for (const field of ["teamId", "campaignId", "assignedToId", "status", "notes", "source"]) expect(consultationInput.safeParse({ ...valid, [field]: "tampered" }).success).toBe(false);
  });
  it("rejects unsupported equipment, invalid phones and fractional or excessive fleets", () => {
    for (const patch of [{ equipmentType: "unoffered" }, { phone: "123" }, { phone: "not a phone number" }, { fleetSize: 0 }, { fleetSize: 1.5 }, { fleetSize: 10001 }]) expect(consultationInput.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it("bounds messages and rejects invalid contact preference or retry keys", () => {
    for (const patch of [{ message: " " }, { message: "x".repeat(4001) }, { preferredContactMethod: "TEXT" }, { requestId: "guessable-id" }]) expect(consultationInput.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it("requires a version and real calendar date for private workflow updates", () => {
    expect(leadWorkflowUpdate.safeParse({ status: "WON" }).success).toBe(false);
    expect(leadWorkflowUpdate.safeParse({ version: 1, followUpDate: "2026-02-30" }).success).toBe(false);
    expect(leadWorkflowUpdate.parse({ version: 1, followUpDate: null, status: "ONBOARDING" }).status).toBe("ONBOARDING");
  });
});

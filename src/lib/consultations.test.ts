import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ db: { $transaction: vi.fn(), lead: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, auditEvent: { create: vi.fn() } }, email: vi.fn(), config: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/lib/auth-config", () => ({ authConfiguration: () => ({ secret: "test-placeholder-secret-of-sufficient-length", origin: "https://example.invalid" }) }));
vi.mock("@/lib/inquiry-email", () => ({ inquiryEmailConfiguration: mocks.config, deliverInquiryEmail: mocks.email }));
import { saveConsultation } from "./consultations";
const input = { requestId: "086d0564-a748-4d4e-a1f0-88d9a5c90203", contactName: "Test contact", companyName: "Test carrier", email: "contact@example.invalid", phone: "+1 202 555 0100", equipmentType: "reefer", fleetSize: 1, preferredContactMethod: "EMAIL" as const, message: "Test scheduling request." };
beforeEach(() => {
  vi.clearAllMocks(); mocks.config.mockReturnValue({ key: "test-placeholder" });
  mocks.db.$transaction.mockImplementation(async callback => callback(mocks.db));
  mocks.db.lead.findUnique.mockResolvedValue(null);
  mocks.db.lead.create.mockImplementation(async ({ data }) => ({ id: "test-lead", ...data }));
  mocks.db.auditEvent.create.mockResolvedValue({}); mocks.db.lead.findUniqueOrThrow.mockResolvedValue({ notificationStatus: "PENDING" }); mocks.db.lead.updateMany.mockResolvedValue({ count: 1 }); mocks.db.lead.update.mockResolvedValue({});
});
describe("saving and notification are independent", () => {
  it("never sends an email or returns saved success when the database transaction fails", async () => {
    mocks.db.$transaction.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(saveConsultation(input)).rejects.toThrow("database unavailable"); expect(mocks.email).not.toHaveBeenCalled();
  });
  it("returns saved success with failed notification after the database commit", async () => {
    mocks.email.mockImplementation(async () => { expect(mocks.db.auditEvent.create).toHaveBeenCalled(); return "failed"; });
    expect(await saveConsultation(input)).toEqual({ saved: true, notification: "failed", created: true });
    expect(mocks.db.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notificationStatus: "FAILED" }) }));
  });
  it("keeps the saved result truthful if notification tracking itself is unavailable", async () => {
    mocks.db.lead.findUniqueOrThrow.mockRejectedValueOnce(new Error("tracking unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await saveConsultation(input)).toEqual({ saved: true, notification: "pending", created: true }); expect(mocks.db.lead.create).toHaveBeenCalledOnce(); log.mockRestore();
  });
});

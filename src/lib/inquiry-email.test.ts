import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverInquiryEmail, inquiryEmailConfiguration } from "./inquiry-email";
afterEach(() => vi.unstubAllEnvs());
function configured() { vi.stubEnv("RESEND_API_KEY", "unit-test-placeholder"); vi.stubEnv("MAIL_FROM", "Dispatch <sender@example.invalid>"); vi.stubEnv("INQUIRY_NOTIFICATION_EMAIL", "recipient@example.invalid"); }
describe("optional inquiry notification outcomes", () => {
  it("does not call a mail provider until sender, recipient and key are configured", async () => {
    vi.stubEnv("RESEND_API_KEY", ""); const transport = vi.fn();
    expect(await deliverInquiryEmail("lead-test", "https://example.invalid", transport)).toBe("not_configured"); expect(transport).not.toHaveBeenCalled();
    expect(inquiryEmailConfiguration({ RESEND_API_KEY: "placeholder", MAIL_FROM: "bad sender", INQUIRY_NOTIFICATION_EMAIL: "private@example.invalid" })).toBeNull();
  });
  it("reports rejected, interrupted and malformed provider responses as failed", async () => {
    configured();
    expect(await deliverInquiryEmail("lead-test", "https://example.invalid", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })))).toBe("failed");
    expect(await deliverInquiryEmail("lead-test", "https://example.invalid", vi.fn().mockRejectedValue(new Error("network failed")))).toBe("failed");
    expect(await deliverInquiryEmail("lead-test", "https://example.invalid", vi.fn().mockResolvedValue(Response.json({})))).toBe("failed");
  });
  it("uses a stable delivery key and sends only a private link; provider acceptance is explicit", async () => {
    configured(); const transport = vi.fn().mockResolvedValue(Response.json({ id: "provider-receipt" }));
    expect(await deliverInquiryEmail("lead-test", "https://example.invalid", transport)).toBe("sent");
    const [url, options] = transport.mock.calls[0]; expect(url).toBe("https://api.resend.com/emails"); expect(options.headers["Idempotency-Key"]).toBe("consultation-lead-test");
    const body = JSON.parse(options.body); expect(Object.keys(body).sort()).toEqual(["from", "subject", "text", "to"]); expect(body.text).toContain("/dashboard/leads/lead-test"); expect(body).not.toHaveProperty("notes");
  });
});

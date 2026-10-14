import { describe, expect, it } from "vitest";
import { runtimeProblems } from "../../deploy/check-runtime.mjs";
const base = { DATABASE_URL: "postgresql://fixture:fixture@db:5432/fixture", AUTH_SECRET: "x".repeat(64), APP_URL: "https://dispatch.example.invalid", PUBLIC_SITE_URL: "https://dispatch.example.invalid" };
describe("production container configuration guards", () => {
  it("accepts structurally complete settings without provider requirements", () => { expect(runtimeProblems(base)).toEqual([]); });
  it("rejects placeholders, missing secrets, HTTP and origins containing paths", () => { expect(runtimeProblems({ ...base, AUTH_SECRET: "CHANGE_ME", APP_URL: "http://example.invalid", PUBLIC_SITE_URL: "https://example.invalid/path" })).toHaveLength(3); });
  it("rejects unauthenticated database connections and untrusted header names", () => { expect(runtimeProblems({ ...base, DATABASE_URL: "postgresql://db/fixture", TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for" })).toHaveLength(2); });
  it("requires complete optional provider settings and never prints secret values", () => { const secret = "private-test-secret"; const failures = runtimeProblems({ ...base, DATABASE_URL: secret, RESEND_API_KEY: secret, INQUIRY_NOTIFICATION_EMAIL: "fixture@example.invalid" }); expect(failures.join(" ")).not.toContain(secret); expect(failures).toHaveLength(3); });
});

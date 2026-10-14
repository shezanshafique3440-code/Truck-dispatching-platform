import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/auth-config", () => ({ authConfigured: mocks.configured }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ $queryRaw: mocks.query }) }));
import { GET } from "./route";
beforeEach(() => { vi.clearAllMocks(); mocks.configured.mockReturnValue(true); mocks.query.mockResolvedValue([]); });
describe("public readiness without private data", () => {
  it("requires authenticated database connectivity and the key schema before success", async () => { const r = await GET(); expect(r.status).toBe(200); expect(await r.json()).toEqual({ status: "ok" }); expect(r.headers.get("cache-control")).toBe("no-store"); expect(mocks.query).toHaveBeenCalledOnce(); });
  it("fails closed for incomplete production auth settings", async () => { mocks.configured.mockReturnValue(false); const r = await GET(); expect(r.status).toBe(503); expect(await r.json()).toEqual({ status: "unavailable" }); expect(mocks.query).not.toHaveBeenCalled(); });
  it("does not disclose connection errors, credentials or business data", async () => { mocks.query.mockRejectedValue(new Error("private connection detail")); const r = await GET(); expect(r.status).toBe(503); expect(await r.text()).not.toContain("private"); });
});

import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/http", () => ({ HttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { withWriteSlot } from "./database-write-queue";
it("keeps write bursts ordered and releases the lane even after a failed mutation", async () => {
  const order: number[] = []; let release!: () => void;
  const blocker = new Promise<void>(resolve => { release = resolve; });
  const first = withWriteSlot(async () => { order.push(1); await blocker; throw new Error("failed write"); });
  const second = withWriteSlot(async () => { order.push(2); return "saved"; });
  expect(order).toEqual([1]); release(); await expect(first).rejects.toThrow("failed write"); await expect(second).resolves.toBe("saved"); expect(order).toEqual([1, 2]);
});

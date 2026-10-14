import "server-only";
import { HttpError } from "@/lib/http";
type Waiter = { grant: () => void; timer: ReturnType<typeof setTimeout> };
const state = globalThis as unknown as { dispatchWriteQueue?: { active: boolean; waiting: Waiter[] } };
const queue = state.dispatchWriteQueue ??= { active: false, waiting: [] };
// Short manual writes share one FIFO lane per process. Read reports retain the pool.
// PostgreSQL serializable checks still protect other processes and anonymous writers.
export async function withWriteSlot<T>(action: () => Promise<T>): Promise<T> {
  if (queue.active) {
    if (queue.waiting.length >= 500) throw new HttpError(503, "The workspace is busy. Your entries are kept; please retry.");
    await new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { grant: resolve, timer: setTimeout(() => {
        const index = queue.waiting.indexOf(waiter); if (index >= 0) queue.waiting.splice(index, 1);
        reject(new HttpError(503, "The workspace is busy. Your entries are kept; please retry."));
      }, 30000) };
      queue.waiting.push(waiter);
    });
  } else queue.active = true;
  try { return await action(); }
  finally { const next = queue.waiting.shift(); if (next) { clearTimeout(next.timer); next.grant(); } else queue.active = false; }
}

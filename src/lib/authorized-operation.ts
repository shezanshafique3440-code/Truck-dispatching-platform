import "server-only";
import { getDb } from "@/lib/db";
import { actorForSession, currentSession } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/access";
import { isWriteConflict } from "@/lib/database-errors";
import { setTimeout as delay } from "node:timers/promises";
import { withWriteSlot } from "@/lib/database-write-queue";

// Authenticate at each service boundary, then re-read live access in the same snapshot.
export async function authorizedOperation<T>(headers: Headers, mutation: boolean, action: (tx: Prisma.TransactionClient, actor: Actor) => Promise<T>) {
  const session = await currentSession(headers);
  if (!session) throw new HttpError(401, "Please sign in.");
  const execute = async () => { for (let attempt = 0; ; attempt++) {
    try {
      return await getDb().$transaction(async tx => action(tx, await actorForSession(session, tx)), {
        isolationLevel: mutation ? "Serializable" : "RepeatableRead", maxWait: 10000, timeout: 10000,
      });
    } catch (error) {
      // Only rolled-back database serialization/deadlock conflicts are retried.
      // Each attempt rechecks live permissions; a changed record version still returns 409.
      if (!mutation || !isWriteConflict(error) || attempt >= 5) throw error;
      await delay(20 * (attempt + 1) + Math.floor(Math.random() * 80));
    }
  } };
  return mutation ? withWriteSlot(execute) : execute();
}

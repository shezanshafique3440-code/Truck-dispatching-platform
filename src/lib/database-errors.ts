// Prisma 7 surfaces serialization conflicts both as P2034 and adapter causes.
export function isWriteConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; cause?: { kind?: string; originalCode?: string } };
  return e.code === "P2034" || e.code === "40001" || e.code === "40P01" || e.cause?.kind === "TransactionWriteConflict" || e.cause?.originalCode === "40001" || e.cause?.originalCode === "40P01";
}

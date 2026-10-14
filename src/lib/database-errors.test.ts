import { expect, it } from "vitest";
import { isWriteConflict } from "./database-errors";
it("recognizes only database write conflicts, never stale user commands or other failures", () => {
  expect(isWriteConflict({ code: "P2034" })).toBe(true);
  expect(isWriteConflict({ cause: { kind: "TransactionWriteConflict", originalCode: "40001" } })).toBe(true);
  for (const error of [{ code: "P2002" }, { status: 409 }, new Error("Database unavailable"), null]) expect(isWriteConflict(error)).toBe(false);
});

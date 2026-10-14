import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { authConfiguration } from "@/lib/auth-config";
// One atomic PostgreSQL upsert. Distributed workers cannot race a get/set counter.
export async function consumeLimit(identifier: string, rule: { window: number; max: number }) {
  const key = createHmac("sha256", authConfiguration().secret).update(identifier).digest("hex");
  const now = BigInt(Date.now()); const cutoff = now - BigInt(rule.window * 1000);
  const rows = await getDb().$queryRaw<{ count: number; lastRequest: bigint }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest") VALUES (${randomUUID()}, ${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN 1 ELSE LEAST("RateLimit"."count" + 1, 1000000) END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN ${now} ELSE "RateLimit"."lastRequest" END
    RETURNING "count", "lastRequest"`;
  const row = rows[0]; const allowed = row.count <= rule.max;
  return { allowed, retryAfter: allowed ? null : Math.max(1, Math.ceil((Number(row.lastRequest) + rule.window * 1000 - Number(now)) / 1000)) };
}
export function clientBucket(headers: Headers) {
  // Trust only a configured single header overwritten by an isolated reverse proxy.
  const configured = process.env.TRUSTED_CLIENT_IP_HEADER;
  if (configured && ["x-real-ip", "cf-connecting-ip"].includes(configured)) {
    const value = headers.get(configured); if (value && value.length <= 64 && !value.includes(",")) return value;
  }
  return "shared-origin";
}

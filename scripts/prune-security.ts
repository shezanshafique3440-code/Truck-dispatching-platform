import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const now = new Date();
  const [sessions, verifications, counters, previews] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(now.valueOf() - 24 * 60 * 60 * 1000) } } }),
    db.importBatch.deleteMany({ where: { state: "STAGED", expiresAt: { lt: new Date(now.valueOf() - 7 * 24 * 60 * 60 * 1000) }, entries: { none: {} } } }),
  ]);
  console.log(`Removed ${sessions.count} expired sessions, ${verifications.count} expired verifications, ${counters.count} stale throttle counters and ${previews.count} uncommitted previews expired over seven days ago. Performance and audit history was preserved.`);
} finally { await db.$disconnect(); }

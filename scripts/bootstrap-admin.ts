import "dotenv/config";
import { parseArgs } from "node:util";
import { randomBytes, createHash } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { email } from "../src/lib/validation";
const { values } = parseArgs({ options: { email: { type: "string" }, output: { type: "string" } } });
if (!values.email || !values.output || !process.env.DATABASE_URL || !process.env.APP_URL) throw new Error("Supply --email, --output and configured DATABASE_URL/APP_URL. No password is accepted on the command line.");
const recipient = email.parse(values.email); const origin = new URL(process.env.APP_URL).origin;
if (!origin.startsWith("https://") && !(process.env.NODE_ENV === "development" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) throw new Error("Use HTTPS, or local HTTP only in development.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const token = randomBytes(32).toString("hex");
let fileCreated = false; let saved = false;
try {
  // Write privately first and exclusively, so an existing file is never overwritten.
  await writeFile(values.output, `${origin}/invite#token=${token}\n`, { flag: "wx", mode: 0o600 });
  fileCreated = true;
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261014)`;
    if (await tx.user.count({ where: { role: "ADMIN" } })) throw new Error("An administrator already exists. Bootstrap is disabled.");
    if (await tx.invitation.count({ where: { bootstrap: true, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } })) throw new Error("A bootstrap invitation is already pending. Use the privately saved link or wait for expiry.");
    const invitation = await tx.invitation.create({ data: { email: recipient, role: "ADMIN", bootstrap: true, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    await tx.auditEvent.create({ data: { action: "ADMIN_BOOTSTRAP_REQUESTED", entityType: "invitation", entityId: invitation.id } });
  }, { isolationLevel: "Serializable" });
  saved = true;
  console.log("Bootstrap invitation saved privately to the requested output file. It expires in one hour. Open it securely and choose your password in the browser; no administrator exists until acceptance.");
} finally { if (fileCreated && !saved) await unlink(values.output); await db.$disconnect(); }

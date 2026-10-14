import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for private database operations.");
  if (!globalDb.prisma) {
    globalDb.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 10 }) });
  }
  return globalDb.prisma;
}

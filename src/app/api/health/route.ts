import { authConfigured } from "@/lib/auth-config";
import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
// Public readiness only: no business data, versions, configuration or error details.
export async function GET() {
  try {
    if (!authConfigured()) throw new Error("Unavailable");
    // LIMIT 0 verifies authenticated connectivity and key tables without reading rows.
    await getDb().$queryRaw`SELECT 1 FROM "User", "Lead", "PerformanceEntry", "ImportBatch", "ImportRow" LIMIT 0`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}

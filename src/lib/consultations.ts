import "server-only";
import { createHmac } from "node:crypto";
import { getDb } from "@/lib/db";
import { authConfiguration } from "@/lib/auth-config";
import { HttpError } from "@/lib/http";
import { deliverInquiryEmail, inquiryEmailConfiguration, type NotificationOutcome } from "@/lib/inquiry-email";
import type { ConsultationInput } from "@/lib/lead-validation";

async function notificationOutcome(leadId: string): Promise<NotificationOutcome> {
  const db = getDb();
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, select: { notificationStatus: true } });
  if (lead.notificationStatus !== "PENDING") return lead.notificationStatus.toLowerCase() as NotificationOutcome;
  // Atomic claim across workers; a stale claim may be retried with the provider's same key.
  const claimed = await db.lead.updateMany({ where: { id: leadId, notificationStatus: "PENDING", OR: [{ notificationAttemptedAt: null }, { notificationAttemptedAt: { lt: new Date(Date.now() - 60000) } }] }, data: { notificationAttemptedAt: new Date() } });
  if (!claimed.count) return "pending";
  const outcome = await deliverInquiryEmail(leadId, authConfiguration().origin);
  try {
    await db.lead.update({ where: { id: leadId }, data: { notificationStatus: outcome === "sent" ? "SENT" : outcome === "not_configured" ? "NOT_CONFIGURED" : "FAILED", ...(outcome === "sent" ? { notifiedAt: new Date() } : {}) } });
  } catch { console.error("Inquiry notification tracking update failed; inquiry remains saved."); }
  return outcome;
}

export async function saveConsultation(input: ConsultationInput) {
  const { requestId, website: _website, contactName, ...details } = input;
  void _website;
  const hash = createHmac("sha256", authConfiguration().secret).update(JSON.stringify({ contactName, ...details })).digest("hex");
  const db = getDb();
  let lead;
  let created = false;
  // A client-generated random key makes an interrupted-response retry safe.
  try {
    lead = await db.$transaction(async tx => {
      const existing = await tx.lead.findUnique({ where: { submissionKey: requestId } });
      if (existing) return existing;
      const record = await tx.lead.create({ data: { name: contactName, ...details, source: "CONSULTATION", submissionKey: requestId, submissionHash: hash, notificationStatus: inquiryEmailConfiguration() ? "PENDING" : "NOT_CONFIGURED" } });
      await tx.auditEvent.create({ data: { action: "CONSULTATION_RECEIVED", entityType: "lead", entityId: record.id } });
      created = true; return record;
    });
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
    lead = await db.lead.findUniqueOrThrow({ where: { submissionKey: requestId } });
  }
  if (lead.submissionHash !== hash) throw new HttpError(409, "This request was already saved with different details. Start a new request to change them.");
  // The database commit above is complete. Email errors never turn a saved inquiry into failure.
  let notification: NotificationOutcome = "pending";
  try { notification = await notificationOutcome(lead.id); }
  catch { console.error("Inquiry email notification unavailable; inquiry remains saved."); }
  return { saved: true as const, notification, created };
}

import { z } from "zod";
import { company } from "@/config/company";

export type NotificationOutcome = "not_configured" | "pending" | "sent" | "failed";
// Kept free of database side effects so delivery failures can be verified independently.
export function inquiryEmailConfiguration(env: Record<string, string | undefined> = process.env) {
  const from = env.MAIL_FROM?.trim(); const to = env.INQUIRY_NOTIFICATION_EMAIL?.trim();
  const senderAddress = from?.match(/<([^<>]+)>$/)?.[1] ?? from;
  if (!env.RESEND_API_KEY || !from || !to || !z.email().safeParse(senderAddress).success || !z.email().safeParse(to).success || /[\r\n]/.test(from)) return null;
  return { key: env.RESEND_API_KEY, from, to };
}
export async function deliverInquiryEmail(leadId: string, origin: string, transport: typeof fetch = fetch): Promise<NotificationOutcome> {
  const config = inquiryEmailConfiguration(); if (!config) return "not_configured";
  try {
    // No public message, contact data or internal notes are sent to the mail provider.
    const response = await transport("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", "Idempotency-Key": `consultation-${leadId}` },
      body: JSON.stringify({ from: config.from, to: [config.to], subject: `${company.name}: new consultation request`, text: `A consultation request has been saved. Review it in the private workspace:\n${origin}/dashboard/leads/${encodeURIComponent(leadId)}` }),
    });
    if (!response.ok) return "failed";
    const receipt: unknown = await response.json();
    return receipt && typeof receipt === "object" && "id" in receipt && typeof receipt.id === "string" ? "sent" : "failed";
  } catch { return "failed"; }
}

import { z } from "zod";
import { offeredEquipment } from "@/config/company";
import { id, date } from "@/lib/validation";
import { leadStatuses } from "@/lib/lead-options";

const phone = z.string().trim().max(40).regex(/^[+\d\s().-]+$/, "Use a valid phone number.")
  .refine(v => { const digits = v.replace(/\D/g, ""); return digits.length >= 7 && digits.length <= 20; }, "Use 7–20 phone digits.");
export const consultationInput = z.object({
  requestId: z.uuid(),
  contactName: z.string().trim().min(2, "Enter your contact name.").max(120),
  companyName: z.string().trim().min(2, "Enter your company name.").max(160),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  phone,
  equipmentType: z.string().max(60).refine(v => offeredEquipment.some(e => e.id === v), "Choose an offered equipment type."),
  fleetSize: z.number().int().min(1, "Fleet size must be at least 1.").max(10000),
  preferredContactMethod: z.enum(["EMAIL", "PHONE"]),
  message: z.string().trim().min(1, "Tell us what dispatch support you need.").max(4000),
  website: z.string().max(200).optional(),
}).strict();
export type ConsultationInput = z.infer<typeof consultationInput>;
export const leadQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(leadStatuses).optional(),
  source: z.enum(["CONSULTATION", "MANUAL"]).optional(),
  teamId: id.optional(), campaignId: id.optional(), assignedToId: id.optional(),
  assignment: z.enum(["unassigned", "assigned"]).optional(),
  triage: z.literal("untriaged").optional(),
  followUp: z.enum(["due", "scheduled", "none"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
export type LeadQuery = z.infer<typeof leadQuery>;
export const leadWorkflowUpdate = z.object({
  version: z.number().int().min(1),
  status: z.enum(leadStatuses).optional(),
  teamId: id.nullable().optional(),
  campaignId: id.nullable().optional(),
  assignedToId: id.nullable().optional(),
  followUpDate: date.nullable().optional(),
}).strict().refine(v => Object.keys(v).some(k => k !== "version"), "Choose a change to save.");
export const leadNoteInput = z.object({ body: z.string().trim().min(1).max(2000) }).strict();

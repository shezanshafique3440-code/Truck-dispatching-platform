import { z } from "zod";
import { currency, date, id } from "@/lib/validation";
export const performanceStates = ["DRAFT", "SUBMITTED", "APPROVED"] as const;
const count = z.number().int().min(0).max(1000000);
export const money = z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Use a nonnegative decimal amount with at most two decimal places.");
export const signedMoney = z.string().trim().regex(/^-?\d{1,12}(\.\d{1,2})?$/, "Use a decimal amount with at most two decimal places; adjustments may be negative.");
export const performanceMetrics = z.object({ callsMade: count, followUpsCompleted: count, qualifiedLeads: count, carriersSigned: count, loads: count.nullable(), dispatchFees: money, refunds: money, adjustments: signedMoney, grossRevenue: money.nullable(), notes: z.string().trim().max(2000).nullable() }).strict();
export const performanceInput = z.object({ dispatcherId: id.optional(), teamId: id.optional(), campaignId: id, date, currency }).merge(performanceMetrics.partial()).strict();
const version = z.number().int().min(1);
const reason = z.string().trim().min(10, "Explain the reason in at least 10 characters.").max(1000);
export const performanceAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("saveDraft"), version, changes: performanceInput.partial().strict().refine(v => Object.keys(v).length > 0) }).strict(),
  z.object({ action: z.literal("submit"), version }).strict(),
  z.object({ action: z.literal("approve"), version }).strict(),
  z.object({ action: z.literal("returnToDraft"), version, reason }).strict(),
  z.object({ action: z.literal("correct"), version, changes: performanceMetrics.partial().strict().refine(v => Object.keys(v).length > 0), reason }).strict(),
  z.object({ action: z.literal("archive"), version, reason }).strict(),
  z.object({ action: z.literal("restore"), version, reason }).strict(),
]);
export const performanceListQuery = z.object({ campaignId: id.optional(), teamId: id.optional(), dispatcherId: id.optional(), importBatchId: id.optional(), currency: currency.optional(), state: z.enum(performanceStates).optional(), from: date.optional(), to: date.optional(), archived: z.enum(["active", "all"]).default("active"), page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().refine(v => !v.from || !v.to || v.from <= v.to, "Start date must be before the end date.");
export const reportQuery = z.object({ campaignId: id.optional(), teamId: id.optional(), dispatcherId: id.optional(), currency, period: z.enum(["daily", "weekly", "monthly"]).default("weekly"), anchor: date.optional() }).strict();
export function cleanQuery(query: Record<string, string>) { return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== "")); }

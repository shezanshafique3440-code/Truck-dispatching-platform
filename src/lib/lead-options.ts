export const leadStatuses = ["NEW", "CONTACTED", "QUALIFIED", "ONBOARDING", "WON", "LOST"] as const;
export const statusLabels: Record<typeof leadStatuses[number], string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", ONBOARDING: "Onboarding", WON: "Won", LOST: "Lost",
};
export const sourceLabels = { CONSULTATION: "Website inquiry", MANUAL: "Manual lead" } as const;
export const notificationLabels = { NOT_CONFIGURED: "Email alerts are not configured", PENDING: "Email alert pending", SENT: "Email alert accepted by provider", FAILED: "Email alert failed; inquiry is saved" } as const;

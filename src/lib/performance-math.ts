export function toCents(value: string) {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) throw new Error("Invalid decimal money.");
  const sign = value.startsWith("-") ? -1n : 1n;
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  return sign * (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
}
export function fromCents(value: bigint) { const abs = value < 0n ? -value : value; return `${value < 0n ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`; }
export function netFees(fees: string, refunds: string, adjustments: string) { return fromCents(toCents(fees) - toCents(refunds) + toCents(adjustments)); }
export function formatMoney(value: string, currency: string) {
  const cents = toCents(value); const abs = cents < 0n ? -cents : cents;
  return `${currency} ${cents < 0n ? "−" : ""}${(abs / 100n).toLocaleString("en-US")}.${String(abs % 100n).padStart(2, "0")}`;
}
export function conversionRate(carriers: number, qualified: number) { return qualified === 0 ? null : carriers / qualified * 100; }
export function localDate(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function periodBounds(period: "daily" | "weekly" | "monthly", anchor: string) {
  const start = new Date(`${anchor}T12:00:00.000Z`); const end = new Date(start);
  if (period === "weekly") { start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7); end.setTime(start.valueOf()); end.setUTCDate(end.getUTCDate() + 6); }
  if (period === "monthly") { start.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0); }
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
export function datesBetween(from: string, to: string) {
  const dates: string[] = []; const d = new Date(`${from}T12:00:00.000Z`);
  while (d.toISOString().slice(0, 10) <= to && dates.length < 65) { dates.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return dates;
}
export function rankRows<T extends { dispatcherId: string; carriersSigned: number; netFees: string }>(rows: T[]) {
  const sorted = [...rows].sort((a, b) => b.carriersSigned - a.carriersSigned || (toCents(a.netFees) === toCents(b.netFees) ? a.dispatcherId.localeCompare(b.dispatcherId) : toCents(a.netFees) > toCents(b.netFees) ? -1 : 1));
  let rank = 0;
  return sorted.map((row, index) => { const previous = sorted[index - 1]; if (!previous || previous.carriersSigned !== row.carriersSigned || toCents(previous.netFees) !== toCents(row.netFees)) rank = index + 1; return { ...row, rank }; });
}

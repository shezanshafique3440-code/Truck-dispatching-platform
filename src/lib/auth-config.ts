import "server-only";
export function authConfigured() {
  try { authConfiguration(); return true; } catch { return false; }
}
export function authConfiguration() {
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET || !process.env.APP_URL) throw new Error("Authentication is not configured.");
  const secret = process.env.AUTH_SECRET!;
  if (secret.length < 32) throw new Error("AUTH_SECRET must have at least 32 high-entropy characters.");
  const url = new URL(process.env.APP_URL!);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV === "development" && local && url.protocol === "http:")) {
    throw new Error("Authentication requires HTTPS. Local HTTP is allowed only in development.");
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error("APP_URL must be an origin.");
  if (process.env.TRUSTED_CLIENT_IP_HEADER && !["x-real-ip", "cf-connecting-ip"].includes(process.env.TRUSTED_CLIENT_IP_HEADER)) throw new Error("Use a supported trusted client IP header.");
  return { secret, origin: url.origin, secure: url.protocol === "https:" };
}
export function resetEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

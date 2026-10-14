// Shared fail-fast checks for the standalone runner and one-off operator image.
// Errors name the setting, never its value. No credentials are read at build time.
/** @param {Record<string, string | undefined>} env */
export function runtimeProblems(env = process.env) {
  const errors = [];
  const placeholder = value => !value || /CHANGE_ME|REPLACE_WITH/i.test(value);
  function origin(key) {
    if (placeholder(env[key])) { errors.push(`${key}: supply an approved HTTPS origin.`); return; }
    try {
      const u = new URL(env[key]);
      if (u.protocol !== "https:" || u.pathname !== "/" || u.search || u.hash || u.username || u.password) errors.push(`${key}: use HTTPS with no path, query or credentials.`);
    } catch { errors.push(`${key}: use a valid HTTPS origin.`); }
  }
  origin("APP_URL"); origin("PUBLIC_SITE_URL");
  if (placeholder(env.AUTH_SECRET) || env.AUTH_SECRET.length < 32) errors.push("AUTH_SECRET: supply at least 32 high-entropy characters.");
  try {
    const u = new URL(env.DATABASE_URL);
    if (!/^(postgres|postgresql):$/.test(u.protocol) || !u.username || !u.password || u.pathname === "/" || placeholder(u.password)) errors.push("DATABASE_URL: supply an authenticated PostgreSQL connection.");
  } catch { errors.push("DATABASE_URL: supply a valid PostgreSQL connection."); }
  if (env.TRUSTED_CLIENT_IP_HEADER && !["x-real-ip", "cf-connecting-ip"].includes(env.TRUSTED_CLIENT_IP_HEADER)) errors.push("TRUSTED_CLIENT_IP_HEADER: use an explicitly trusted, overwritten header.");
  if (Boolean(env.RESEND_API_KEY) !== Boolean(env.MAIL_FROM)) errors.push("RESEND_API_KEY and MAIL_FROM: configure both or leave both empty.");
  if (env.INQUIRY_NOTIFICATION_EMAIL && (!env.RESEND_API_KEY || !env.MAIL_FROM)) errors.push("INQUIRY_NOTIFICATION_EMAIL: also configure the provider and sender.");
  return errors;
}
if (process.argv[1]?.endsWith("/check-runtime.mjs")) {
  const errors = runtimeProblems();
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("Required production runtime settings are structurally valid; this does not verify connectivity, DNS or provider delivery.");
}

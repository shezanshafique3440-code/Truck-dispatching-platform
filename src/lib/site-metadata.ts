import type { Metadata, MetadataRoute } from "next";
import { company } from "@/config/company";
export const publicPaths = ["/", "/services", "/how-it-works", "/about", "/contact"] as const;
export const privatePaths = ["/dashboard", "/api", "/login", "/invite", "/forgot-password", "/reset-password"] as const;
export const siteDescription = "Explore truck dispatch support for trucking companies and owner-operators. Discuss load sourcing, communication and a workflow for your operation.";
// Never infer an SEO origin from an untrusted request Host or invent a company domain.
export function publicOrigin(env: { PUBLIC_SITE_URL?: string; APP_URL?: string } = { PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL, APP_URL: process.env.APP_URL }) {
  const configured = env.PUBLIC_SITE_URL?.trim(); const candidate = configured || env.APP_URL;
  if (!candidate) return null;
  let url: URL;
  try { url = new URL(candidate); } catch { if (configured) throw new Error("PUBLIC_SITE_URL must be an absolute HTTPS origin."); return null; }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const valid = url.protocol === "https:" && !loopback && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  if (!valid) { if (configured) throw new Error("PUBLIC_SITE_URL must be a public HTTPS origin without a path, query or credentials."); return null; }
  return url.origin;
}
export function publicPageMetadata(title: string, description: string, path: typeof publicPaths[number]): Metadata {
  const origin = publicOrigin(); const completeTitle = `${title} | ${company.name}`;
  const image = origin ? [{ url: `${origin}/social-image`, width: 1200, height: 630, alt: `${company.name} — truck dispatching` }] : undefined;
  return { title, description, robots: { index: Boolean(origin), follow: Boolean(origin) }, ...(origin ? { metadataBase: new URL(origin), alternates: { canonical: origin + path } } : {}), openGraph: { type: "website", siteName: company.name, title: completeTitle, description, ...(origin ? { url: origin + path, images: image } : {}) }, twitter: { card: origin ? "summary_large_image" : "summary", title: completeTitle, description, ...(origin ? { images: image } : {}) } };
}
export function privatePageMetadata(title: string, description = "Invitation-only team workspace. Sign in with an authorized account to continue."): Metadata {
  return { title, description, robots: { index: false, follow: false, noarchive: true, nosnippet: true }, alternates: { canonical: null }, openGraph: null, twitter: null, referrer: "no-referrer" };
}
export function publicSitemap(origin = publicOrigin()): MetadataRoute.Sitemap {
  return origin ? publicPaths.map(path => ({ url: origin + path })) : [];
}
export function crawlRules(origin = publicOrigin()): MetadataRoute.Robots {
  return { rules: { userAgent: "*", ...(origin ? { allow: "/", disallow: privatePaths.flatMap(path => [path, `${path}/`]) } : { disallow: "/" }) }, ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}) };
}

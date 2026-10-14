"use client";
import { LinkProgress } from "@/components/link-progress";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Role } from "@/lib/access";
import { company } from "@/config/company";
import { BrandMark } from "@/components/icons";
export function DashboardNavigation({ role, name }: { role: Role; name: string }) {
  const toggle = useRef<HTMLButtonElement>(null);
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const links = [{ href: "/dashboard", label: "Overview" }, ...(role !== "DISPATCHER" ? [{ href: "/dashboard/teams", label: role === "MANAGER" ? "My teams" : "Teams" }] : []), { href: "/dashboard/campaigns", label: role === "DISPATCHER" ? "Assigned work" : "Campaigns" }, { href: "/dashboard/leads", label: role === "DISPATCHER" ? "My leads" : "Leads" }, { href: "/dashboard/reports", label: role === "DISPATCHER" ? "My reports" : "Reports & rankings" }, { href: "/dashboard/performance", label: role === "DISPATCHER" ? "My performance" : "Performance" }, { href: "/dashboard/imports", label: "Performance imports" }, ...(role === "ADMIN" ? [{ href: "/dashboard/users", label: "Users & invitations" }, { href: "/dashboard/audit", label: "Audit activity" }, { href: "/dashboard/settings", label: "Settings" }] : []), { href: "/dashboard/account", label: "My account" }];
  async function logout() { setBusy(true); setError(""); try { const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); if (!response.ok) throw new Error(); router.replace("/login"); router.refresh(); } catch { setError("Sign-out failed. Please try again."); } finally { setBusy(false); } }
  return <aside className="dashboard-sidebar" onKeyDown={event => { if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); } }}><Link href="/" className="brand"><BrandMark /><span>{company.name}<small>TEAM WORKSPACE</small></span></Link><button ref={toggle} type="button" className="dashboard-nav-toggle" aria-expanded={open} aria-controls="dashboard-links" onClick={() => setOpen(!open)}>Workspace navigation</button><nav id="dashboard-links" aria-label="Dashboard navigation" className={open ? "is-open" : ""}>{links.map(link => <Link key={link.href} href={link.href} aria-current={(path === link.href || (link.href !== "/dashboard" && path.startsWith(link.href + "/"))) ? "page" : undefined} onClick={() => setOpen(false)}><span className="nav-indicator" aria-hidden="true" />{link.label}<LinkProgress /></Link>)}</nav><div className="dashboard-identity"><span className="role-badge">{role.toLowerCase()}</span><p>{name}</p><button type="button" onClick={logout} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>{error && <p role="alert">{error}</p>}</div></aside>;
}

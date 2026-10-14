"use client";
import { LinkProgress } from "@/components/link-progress";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { company } from "@/config/company";
import { BrandMark } from "@/components/icons";
const links = [{ href: "/", label: "Home" }, { href: "/services", label: "Services" }, { href: "/how-it-works", label: "How It Works" }, { href: "/about", label: "About" }, { href: "/contact", label: "Contact" }];
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return <header className="site-header" onKeyDown={event => { if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); } }}>
    <div className="utility-bar"><div className="container"><span>TRUCK DISPATCHING · A CLEAR DIRECTION</span><Link href="/login">Team Login</Link></div></div>
    <div className="container header-inner">
      <Link href="/" className="brand" onClick={() => setOpen(false)}><BrandMark /><span>{company.name}<small>TRUCK DISPATCHING</small></span></Link>
      <button ref={toggle} type="button" className="nav-toggle" aria-expanded={open} aria-controls="public-navigation" aria-label={open ? "Close navigation menu" : "Open navigation menu"} onClick={() => setOpen(!open)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{open ? <path d="m5 5 14 14M19 5 5 19" /> : <path d="M3 6h18M3 12h18M3 18h18" />}</svg><span>Menu</span></button>
      <nav id="public-navigation" aria-label="Main navigation" className={open ? "public-nav is-open" : "public-nav"}>{links.map(link => <Link href={link.href} key={link.href} aria-current={pathname === link.href ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}<LinkProgress /></Link>)}</nav>
    </div>
  </header>;
}

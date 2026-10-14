import Link from "next/link";
import { company } from "@/config/company";
import { BrandMark, ArrowIcon } from "@/components/icons";
export function SiteFooter() {
  return <footer className="site-footer"><div className="container"><div className="footer-main"><div className="footer-brand"><Link href="/" className="brand"><BrandMark /><span>{company.name}<small>TRUCK DISPATCHING</small></span></Link><p>A clear direction for the road ahead.</p></div><nav aria-label="Footer navigation"><p className="footer-label">EXPLORE</p><Link href="/services">Services</Link><Link href="/how-it-works">How It Works</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link></nav><div className="footer-contact"><p className="footer-label">LET’S PLAN YOUR NEXT MOVE</p><Link href="/contact">Discuss your dispatch needs <ArrowIcon direction="up" /></Link>{company.email && <a href={`mailto:${company.email}`}>{company.email}</a>}{company.phone && <a href={`tel:${company.phone}`}>{company.phone}</a>}</div></div><div className="footer-bottom"><p>© {new Date().getFullYear()} {company.name}</p><Link href="/login">Team Login</Link></div></div></footer>;
}

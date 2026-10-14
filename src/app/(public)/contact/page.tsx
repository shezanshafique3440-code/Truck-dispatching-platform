import { publicPageMetadata } from "@/lib/site-metadata";
import Link from "next/link";
import { company } from "@/config/company";
import { ArrowIcon } from "@/components/icons";
import { PageIntro } from "@/components/public-sections";
import { ConsultationForm } from "@/components/consultation-form";
export const metadata = publicPageMetadata("Contact", "Request a dispatch consultation around your equipment, fleet, preferred lanes and operating priorities.", "/contact");
export default function ContactPage() {
  return <main id="main-content" tabIndex={-1}><PageIntro eyebrow="LET’S TALK ABOUT YOUR NEXT MOVE" title="Request a Dispatch Consultation" description="Start with your equipment, your lanes and what you need from dispatch. A first conversation is about understanding the right fit." /><section className="section container contact-grid"><div className="contact-card"><ConsultationForm /></div><aside className="consultation-notes"><p className="eyebrow">WHAT TO DISCUSS</p><h2>A few details to have in mind.</h2><ul className="plain-list"><li>Your equipment and trailer specifications</li><li>Preferred lanes and operating areas</li><li>Scheduling needs and availability</li><li>The dispatch support you’re looking for</li></ul><p className="muted">Service availability, responsibilities and terms are discussed before any commitment.</p>{company.email && <a className="contact-method" href={`mailto:${company.email}`}><span>Email</span>{company.email}</a>}{company.phone && <a className="contact-method" href={`tel:${company.phone}`}><span>Phone</span>{company.phone}</a>}{company.address && <address>{company.address}</address>}<Link href="/services" className="text-link">Explore the service scope <ArrowIcon direction="up" /></Link></aside></section></main>;
}

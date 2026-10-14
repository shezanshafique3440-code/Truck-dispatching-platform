import { publicPageMetadata } from "@/lib/site-metadata";
import Link from "next/link";
import { company } from "@/config/company";
import { ServiceIcon, ArrowIcon } from "@/components/icons";
import { ConsultationCTA, EquipmentSection, PageIntro } from "@/components/public-sections";
export const metadata = publicPageMetadata("Services", "Explore load sourcing, rate negotiation, paperwork coordination and broker communication. Discuss dispatch scope for your operation.", "/services");
export default function ServicesPage() {
  return <main id="main-content" tabIndex={-1}><PageIntro eyebrow="DISPATCH SERVICES" title="The details matter. Keep them moving together." description="Explore the proposed service scope below. Availability, responsibilities and terms are confirmed during your consultation." /><section className="section container service-details" aria-label="Service details">{company.publicContent.services.map((service, i) => <article id={service.id} key={service.id} className="service-detail"><div className="detail-title"><span className="detail-number">0{i + 1}</span><ServiceIcon name={service.icon} /><h2>{service.title}</h2></div><div><p className="detail-copy">{service.detail}</p><ul className="plain-list">{service.points.map(point => <li key={point}>{point}</li>)}</ul><Link href="/contact" className="text-link">Discuss your requirements <ArrowIcon direction="up" /></Link></div></article>)}</section><EquipmentSection /><ConsultationCTA /></main>;
}

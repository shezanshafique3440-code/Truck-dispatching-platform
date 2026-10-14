import Link from "next/link";
import { company, offeredEquipment } from "@/config/company";
import { ArrowIcon, EquipmentArt, ServiceIcon } from "@/components/icons";
import { ButtonLink, SectionHeading } from "@/components/ui";
export function ServiceCards() {
  return <div className="services-grid">{company.publicContent.services.map((service, i) => <article className="service-card" key={service.id}><div className="service-card-top"><ServiceIcon name={service.icon} /><span>0{i + 1}</span></div><h3><Link href={`/services#${service.id}`}>{service.title}<ArrowIcon direction="up" /></Link></h3><p>{service.description}</p></article>)}</div>;
}
export function EquipmentSection() {
  if (!offeredEquipment.length) return null;
  return <section className="section equipment-section"><div className="container"><div className="section-top"><SectionHeading eyebrow="YOUR EQUIPMENT. YOUR OPERATION." title="A conversation built around what you run.">Discuss availability and dispatch scope for your equipment.</SectionHeading><Link href="/contact" className="text-link">Discuss equipment fit <ArrowIcon direction="up" /></Link></div><div className="equipment-grid">{offeredEquipment.map(item => <article className="equipment-card" key={item.id}><EquipmentArt type={item.id} /><h3>{item.name}</h3><p>{item.description}</p></article>)}</div></div></section>;
}
export function OnboardingSteps({ detailed = false }: { detailed?: boolean }) {
  return <ol className={detailed ? "onboarding-steps detailed-steps" : "onboarding-steps"}>{company.publicContent.onboarding.map((step, i) => <li key={step.title}><span className="step-number">0{i + 1}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>;
}
export function ConsultationCTA() {
  return <section className="consultation-section"><div className="container consultation-panel"><div><p className="eyebrow">YOUR NEXT MOVE STARTS HERE</p><h2>Let’s talk about<br />the road ahead.</h2><p>Tell us what you run and where you want to go. Start with a conversation about the right fit.</p></div><ButtonLink href="/contact">{company.publicContent.consultationLabel}<ArrowIcon /></ButtonLink></div></section>;
}
export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="page-intro"><div className="container"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></section>;
}

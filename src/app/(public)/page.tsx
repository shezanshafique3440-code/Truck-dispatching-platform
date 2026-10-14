import { publicPageMetadata, siteDescription } from "@/lib/site-metadata";
import Image from "next/image";
import Link from "next/link";
import { company } from "@/config/company";
import { ArrowIcon } from "@/components/icons";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { ConsultationCTA, EquipmentSection, OnboardingSteps, ServiceCards } from "@/components/public-sections";
export const metadata = publicPageMetadata("Truck dispatching", siteDescription, "/");
export default function HomePage() {
  const content = company.publicContent;
  return <main id="main-content" tabIndex={-1}>
    <section className="hero"><div className="container hero-grid"><div className="hero-copy"><p className="eyebrow"><span className="small-line" /> A CLEAR DIRECTION FOR THE ROAD AHEAD</p><h1>{content.heroHeadline.split(". ")[0]}.{" "}<br /><span>{content.heroHeadline.split(". ")[1]}</span></h1><p className="hero-description">{content.heroDescription}</p><div className="hero-actions"><ButtonLink href="/contact">{content.consultationLabel}<ArrowIcon /></ButtonLink><Link href="/services" className="text-link">Explore services <ArrowIcon direction="up" /></Link></div><p className="hero-note">YOUR EQUIPMENT. YOUR PRIORITIES. YOUR NEXT MOVE.</p></div><figure className="hero-photo"><Image src={content.heroImage.src} alt={content.heroImage.alt} fill sizes="(max-width: 800px) calc(100vw - 40px), (max-width: 1360px) calc(50vw - 68px), 600px" preload /><figcaption>{content.heroImage.caption}</figcaption><div className="photo-label" aria-hidden="true"><span>THE ROAD AHEAD</span><span>Driven by your priorities.<br />Grounded in a plan.</span></div></figure></div></section>
    <div className="audience-strip"><div className="container"><span>FOR THE PEOPLE WHO KEEP FREIGHT MOVING</span><span>Owner-operators</span><span>Trucking companies</span><span>Fleet teams</span></div></div>
    <section className="section container"><div className="section-top"><SectionHeading eyebrow="DISPATCH, WITH DIRECTION" title="Less to coordinate. More room to focus.">Explore a practical dispatch workflow, from reviewing loads to keeping the details organized.</SectionHeading><Link href="/services" className="text-link">View all services <ArrowIcon direction="up" /></Link></div><ServiceCards /></section>
    <EquipmentSection />
    <section className="section container"><div className="section-top"><SectionHeading eyebrow="HOW IT WORKS" title="A clear start. A considered next step.">Understand the fit, agree on the scope and establish a working plan.</SectionHeading><Link href="/how-it-works" className="text-link">See the process <ArrowIcon direction="up" /></Link></div><OnboardingSteps /></section>
    <ConsultationCTA />
  </main>;
}

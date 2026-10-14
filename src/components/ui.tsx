import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowIcon } from "@/components/icons";
export function ButtonLink({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
  return <Link href={href} className={`button ${secondary ? "button-secondary" : "button-primary"}`}>{children}</Link>;
}
export function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children && <p className="muted">{children}</p>}</div>;
}
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><ArrowIcon direction="up" /><h2>{title}</h2><p className="muted">{children}</p></div>;
}

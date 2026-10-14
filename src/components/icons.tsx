import type { CSSProperties } from "react";
export function ArrowIcon({ direction = "right", className = "" }: { direction?: "right" | "up"; className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={direction === "up" ? { transform: "rotate(-45deg)" } : undefined}><path d="M4 12h15M13 5l7 7-7 7" /></svg>;
}
export function BrandMark() {
  return <svg viewBox="0 0 36 36" width="36" height="36" fill="none" aria-hidden="true"><rect width="36" height="36" fill="#F97316" /><path d="M9 26V10l18 16V10M18 10v5M18 21v5" stroke="#0B1220" strokeWidth="2.3" /></svg>;
}
export type ServiceIconName = "route" | "negotiation" | "paperwork" | "communication";
export function ServiceIcon({ name }: { name: ServiceIconName }) {
  const paths = {
    route: <><circle cx="7" cy="7" r="3" /><circle cx="25" cy="25" r="3" /><path d="M10 7h10a5 5 0 0 1 0 10h-8a5 5 0 0 0 0 10h10" /></>,
    negotiation: <><path d="M5 9h22M5 16h22M5 23h22" /><circle cx="11" cy="9" r="3" fill="white" /><circle cx="22" cy="16" r="3" fill="white" /><circle cx="14" cy="23" r="3" fill="white" /></>,
    paperwork: <><path d="M8 3h12l5 5v21H8zM20 3v6h5M12 15h9M12 20h9M12 25h5" /></>,
    communication: <><path d="M5 5h23v17H14l-9 6zM10 11h13M10 16h9" /></>,
  };
  return <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function EquipmentArt({ type }: { type: string }) {
  const body: CSSProperties = { color: "var(--navy)" };
  return <svg className="equipment-art" viewBox="0 0 300 100" fill="none" stroke="currentColor" strokeWidth="1.5" style={body} aria-hidden="true">
    {type === "flatbed" ? <path d="M20 60h182v8H20zM48 60V39M88 60V39M128 60V39M168 60V39" /> : <><path d="M20 19h180v49H20z" /><path d="M31 25v35M42 25v35M53 25v35M64 25v35M75 25v35M86 25v35M97 25v35M108 25v35M119 25v35M130 25v35M141 25v35M152 25v35M163 25v35M174 25v35M185 25v35" opacity=".2" />{type === "reefer" && <path d="M202 23h12v31h-12M205 29h6M205 35h6M205 41h6" />}</>}
    <path d="M211 40h30l22 18v16h-52zM221 45h17l15 13h-32zM208 68h-11M20 74h18M78 74h150M258 74h18" /><circle cx="49" cy="74" r="9" fill="#f4f4f1" /><circle cx="73" cy="74" r="9" fill="#f4f4f1" /><circle cx="239" cy="74" r="9" fill="#f4f4f1" /><path d="M286 85H14" stroke="#F97316" strokeWidth="2" />
  </svg>;
}

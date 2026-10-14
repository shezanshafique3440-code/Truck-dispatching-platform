import { privatePageMetadata } from "@/lib/site-metadata";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { leadDetails, leadOptions } from "@/lib/leads";
import { HttpError } from "@/lib/http";
import { notificationLabels, sourceLabels, statusLabels } from "@/lib/lead-options";
import { offeredEquipment } from "@/config/company";
import { LeadEditor, LeadNoteForm } from "@/components/lead-forms";

export const metadata = privatePageMetadata("Lead details");
export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(); const h = new Headers(await headers());
  let details;
  try { details = await leadDetails(h, (await params).id); }
  catch (error) { if (error instanceof HttpError && error.status === 404) notFound(); throw error; }
  const { lead, notes, history } = details;
  const choices = actor.role !== "DISPATCHER" ? await leadOptions(h) : null;
  function describe(action: string, metadata: unknown) {
    const data = metadata as { from?: string; to?: string } | null;
    if (action === "LEAD_STATUS_CHANGED") return `Status: ${statusLabels[data?.from as keyof typeof statusLabels] ?? data?.from} → ${statusLabels[data?.to as keyof typeof statusLabels] ?? data?.to}`;
    if (action === "LEAD_FOLLOW_UP_CHANGED") return `Follow-up: ${data?.from ?? "not scheduled"} → ${data?.to ?? "not scheduled"}`;
    return ({ CONSULTATION_RECEIVED: "Website consultation received", LEAD_CREATED: "Manual lead created", LEAD_ASSIGNMENT_CHANGED: "Team, campaign or dispatcher assignment changed", LEAD_UPDATED: "Lead details saved", LEAD_NOTE_ADDED: "Internal note added" } as Record<string, string>)[action] ?? action.toLowerCase().replaceAll("_", " ");
  }
  return <><Link href="/dashboard/leads" className="text-link lead-back">← Back to leads</Link><p className="eyebrow">{sourceLabels[lead.source].toUpperCase()}</p><div className="workspace-title-row"><h1>{lead.name}</h1><span className={`lead-status status-${lead.status.toLowerCase()}`}>{statusLabels[lead.status]}</span></div><p className="muted workspace-intro">{lead.companyName ?? "Company not provided"} · Received {lead.createdAt.toISOString().slice(0, 10)}</p>
    <div className="lead-detail-grid"><div className="lead-detail-main"><section className="lead-panel"><h2>Consultation details</h2><dl className="lead-detail-list"><dt>Email</dt><dd>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : "Not provided"}</dd><dt>Phone</dt><dd>{lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : "Not provided"}</dd><dt>Equipment</dt><dd>{offeredEquipment.find(e => e.id === lead.equipmentType)?.name ?? lead.equipmentType ?? "Not provided"}</dd><dt>Fleet size</dt><dd>{lead.fleetSize ?? "Not provided"}</dd><dt>Preferred contact</dt><dd>{lead.preferredContactMethod?.toLowerCase() ?? "Not provided"}</dd><dt>Team</dt><dd>{lead.team?.name ?? "Untriaged · admin inbox"}</dd><dt>Campaign</dt><dd>{lead.campaign?.name ?? "Not assigned"}</dd><dt>Dispatcher</dt><dd>{lead.assignedTo?.name ?? "Not assigned"}</dd><dt>Next follow-up</dt><dd>{lead.followUpDate?.toISOString().slice(0, 10) ?? "Not scheduled"}</dd></dl><div className="lead-public-message"><h3>Message from the contact</h3><p>{lead.message ?? "No public message. This lead was entered manually."}</p></div>{actor.role !== "DISPATCHER" && lead.source === "CONSULTATION" && <p className="notification-state">{notificationLabels[lead.notificationStatus]}. Saving the inquiry is independent of email delivery.</p>}</section>
      <section className="lead-panel"><p className="eyebrow">PRIVATE TO AUTHORIZED USERS</p><h2>Internal notes</h2>{lead.notes && <div className="lead-note"><p className="lead-note-meta">Existing internal summary</p><p>{lead.notes}</p></div>}{notes.length ? <ol className="lead-note-list">{notes.map(note => <li className="lead-note" key={note.id}><p className="lead-note-meta">{note.author.name} · {note.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p><p>{note.body}</p></li>)}</ol> : !lead.notes && <p className="muted">No internal notes yet.</p>}{notes.length === 100 && <p className="muted field-hint">Showing the latest 100 notes.</p>}{actor.role !== "DISPATCHER" && <LeadNoteForm leadId={lead.id} />}</section>
      <section className="lead-panel"><h2>Audit history</h2>{history.length ? <ol className="lead-history">{history.map(event => <li key={event.id}><strong>{describe(event.action, event.metadata)}</strong><span>{event.actor?.name ?? "Public inquiry"} · {event.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span></li>)}</ol> : <p className="muted">No audit events in your current team scope.</p>}{history.length === 100 && <p className="muted field-hint">Showing the latest 100 permitted events.</p>}</section>
    </div><aside>{choices ? <LeadEditor key={lead.id} lead={{ id: lead.id, version: lead.version, status: lead.status, teamId: lead.teamId, campaignId: lead.campaignId, assignedToId: lead.assignedToId, followUpDate: lead.followUpDate?.toISOString() ?? null }} choices={choices} admin={actor.role === "ADMIN"} /> : <section className="lead-panel"><h2>Your assigned lead</h2><p className="muted">Use the consultation details to prepare your work. Your manager handles lead status, assignment, notes and follow-up changes.</p></section>}</aside></div>
  </>;
}

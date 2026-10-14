"use client";
import { useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/components/form-feedback";
import { useRouter } from "next/navigation";
import { leadStatuses, statusLabels } from "@/lib/lead-options";

export type LeadChoices = {
  teams: { id: string; name: string }[];
  campaigns: { id: string; name: string; teamId: string }[];
  dispatchers: { id: string; name: string; memberships: { teamId: string }[]; assignments: { campaignId: string }[] }[];
};
type LeadEditData = { id: string; version: number; status: typeof leadStatuses[number]; teamId: string | null; campaignId: string | null; assignedToId: string | null; followUpDate: string | null };
export function LeadEditor({ lead, choices, admin }: { lead: LeadEditData; choices: LeadChoices; admin: boolean }) {
  const hydrated = useHydrated(); const router = useRouter(); const feedback = useRef<HTMLParagraphElement>(null);
  const [values, setValues] = useState({ status: lead.status, teamId: lead.teamId ?? "", campaignId: lead.campaignId ?? "", assignedToId: lead.assignedToId ?? "", followUpDate: lead.followUpDate?.slice(0, 10) ?? "" });
  const [version, setVersion] = useState(lead.version);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [failed, setFailed] = useState(false);
  const campaigns = choices.campaigns.filter(c => c.teamId === values.teamId);
  const dispatchers = choices.dispatchers.filter(d => d.memberships.some(m => m.teamId === values.teamId) && (!values.campaignId || d.assignments.some(a => a.campaignId === values.campaignId)));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, status: values.status, ...(admin ? { teamId: values.teamId || null } : {}), campaignId: values.campaignId || null, assignedToId: values.assignedToId || null, followUpDate: values.followUpDate || null }) });
      const result = await response.json(); setFailed(!response.ok);
      if (!response.ok) setMessage(result.error ?? "Could not save changes. Your entries are kept.");
      else { setVersion(result.version); setMessage("Lead changes saved."); router.refresh(); }
    } catch { setFailed(true); setMessage("Could not confirm the changes. Your entries are kept; please retry."); }
    finally { setBusy(false); requestAnimationFrame(() => feedback.current?.focus()); }
  }
  return <section className="lead-panel"><h2>Manage this lead</h2><p className="muted">Assign responsibility and keep the next step clear.</p><form method="post" className="workspace-form" onSubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy || !hydrated} className="consultation-fields">
      <label>Status<select value={values.status} onChange={e => setValues(v => ({ ...v, status: e.target.value as typeof lead.status }))}>{leadStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
      {admin && <label>Team<select value={values.teamId} onChange={e => setValues(v => ({ ...v, teamId: e.target.value, campaignId: "", assignedToId: "" }))}><option value="">Untriaged · admin inbox</option>{choices.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      <label>Campaign<select value={values.campaignId} disabled={!values.teamId} onChange={e => setValues(v => ({ ...v, campaignId: e.target.value, assignedToId: "" }))}><option value="">No campaign</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Assigned dispatcher<select value={values.assignedToId} disabled={!values.teamId} onChange={e => setValues(v => ({ ...v, assignedToId: e.target.value }))}><option value="">Unassigned</option>{dispatchers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}{values.assignedToId && !dispatchers.some(d => d.id === values.assignedToId) && <option value={values.assignedToId}>Current assignment · unavailable</option>}</select></label>
      <label>Next follow-up date<input type="date" value={values.followUpDate} onChange={e => setValues(v => ({ ...v, followUpDate: e.target.value }))} /><span className="muted field-hint">Calendar date in UTC. Clear the field to remove it.</span></label>
      {message && <p ref={feedback} tabIndex={-1} className={failed ? "form-error" : "form-success"} role={failed ? "alert" : "status"}>{message}</p>}
      <button className="button button-primary" type="submit">{busy ? "Saving changes…" : "Save lead changes"}</button>
    </fieldset></form>{!choices.teams.length && <p className="muted field-hint">An administrator must create an active team before this inquiry can be assigned.</p>}</section>;
}
export function LeadNoteForm({ leadId }: { leadId: string }) {
  const hydrated = useHydrated(); const router = useRouter(); const [body, setBody] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [failed, setFailed] = useState(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const result = await response.json(); setFailed(!response.ok);
      if (!response.ok) setMessage(result.error ?? "Could not save your note. Your text is kept.");
      else { setBody(""); setMessage("Internal note saved."); router.refresh(); }
    } catch { setFailed(true); setMessage("Could not confirm your note. Your text is kept; please retry."); }
    finally { setBusy(false); requestAnimationFrame(() => feedback.current?.focus()); }
  }
  return <form method="post" className="workspace-form lead-note-form" onSubmit={submit} aria-busy={busy}><label htmlFor="internal-note">Add an internal note<textarea id="internal-note" value={body} onChange={e => setBody(e.target.value)} rows={4} maxLength={2000} required disabled={busy || !hydrated} /></label><p className="muted field-hint">Visible only to users who are authorized to view this lead. Notes are never shown on the public website or included in email alerts.</p>{message && <p tabIndex={-1} ref={feedback} role={failed ? "alert" : "status"} className={failed ? "form-error" : "form-success"}>{message}</p>}<button className="button button-secondary" disabled={busy || !hydrated} type="submit">{busy ? "Saving note…" : "Save internal note"}</button></form>;
}

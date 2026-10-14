"use client";
import { useState, useId, useRef } from "react";
import { FormFeedback, useHydrated } from "@/components/form-feedback";
import { useRouter } from "next/navigation";
import type { Row } from "@/components/workspace-table";
export function OperationForm({ title, resource, method = "POST", fields, recordField }: { title: string; resource: string; method?: "POST" | "PATCH"; recordField?: string; fields: { name: string; label: string; type?: string; required?: boolean; options?: { value: string; label: string }[]; multiple?: boolean }[] }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [inviteURL, setInviteURL] = useState(""); const router = useRouter();
  const lock = useRef(false); const hydrated = useHydrated(); const feedbackId = useId(); const [invalidFields, setInvalidFields] = useState<string[]>([]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return; lock.current = true; const form = event.currentTarget; setBusy(true); setError(""); setMessage(""); setInviteURL(""); setInvalidFields([]);
    const values = new FormData(form); const body: Record<string, unknown> = {};
    for (const field of fields) {
      const value = values.get(field.name);
      if (value === "__clear__") body[field.name] = null;
      else if (field.multiple) body[field.name] = values.getAll(field.name).filter(Boolean);
      else if (field.type === "number") { if (value !== "" && value !== null) body[field.name] = Number(value); }
      else if (field.type === "boolean") { if (value !== "") body[field.name] = value === "true"; }
      else if (value !== "" && value !== null) body[field.name] = value;
    }
    let endpoint = `/api/workspace/${resource}`;
    if (recordField) { endpoint += `/${encodeURIComponent(String(body[recordField]))}`; delete body[recordField]; }
    try { const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) { const invalid = Array.isArray(data.fields) ? data.fields.filter((v: unknown) => typeof v === "string") : []; setInvalidFields(invalid); const labels = fields.filter(f => invalid.includes(f.name)).map(f => f.label); setError(`${data.error ?? "Could not save the record. Your entries are kept."}${labels.length ? ` Review: ${labels.join(", ")}.` : ""}`); return; } setMessage("Saved successfully."); if (data.invitationURL) setInviteURL(data.invitationURL); form.reset(); router.refresh(); } catch { setError("Could not confirm the save. Your entries are kept; review the latest records before retrying."); } finally { lock.current = false; setBusy(false); }
  }
  return <details className="operation-panel"><summary>{title}</summary><form method="post" className="workspace-form" onSubmit={submit} aria-busy={busy}><fieldset className="consultation-fields" disabled={busy || !hydrated}>{fields.map(field => <label key={field.name}>{field.label}{field.options ? <select aria-invalid={invalidFields.includes(field.name)} aria-describedby={invalidFields.includes(field.name) ? feedbackId : undefined} name={field.name} multiple={field.multiple} required={field.required}>{!field.multiple && <option value="">Select an option</option>}{field.options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : <input aria-invalid={invalidFields.includes(field.name)} aria-describedby={invalidFields.includes(field.name) ? feedbackId : undefined} name={field.name} type={field.type ?? "text"} required={field.required} maxLength={field.name === "notes" || field.name === "description" ? 2000 : 254} min={field.type === "number" ? 0 : undefined} />}</label>)}<FormFeedback id={feedbackId} message={error || message} failed={Boolean(error)} />{inviteURL && <div className="invitation-result"><label>One-time invitation link<input readOnly value={inviteURL} onFocus={event => event.currentTarget.select()} /></label><p className="form-help">Share privately with the intended recipient. This link expires in 48 hours and is shown only once.</p></div>}<button className="button button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save"}</button></fieldset></form></details>;
}
export function options(rows: Row[], key = "id", label = "name") { return rows.map(row => ({ value: String(row[key]), label: String(row[label] ?? row[key]) })); }

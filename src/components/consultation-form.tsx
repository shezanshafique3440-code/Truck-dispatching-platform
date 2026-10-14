"use client";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { offeredEquipment } from "@/config/company";
import type { NotificationOutcome } from "@/lib/inquiry-email";

const subscribe = () => () => {};
const initial = { contactName: "", companyName: "", email: "", phone: "", equipmentType: "", fleetSize: "", preferredContactMethod: "EMAIL", message: "", website: "" };
type Field = keyof typeof initial;
const outcomeText: Record<NotificationOutcome, string> = {
  not_configured: "Your request is saved in our consultation inbox. Email alerts are not currently connected.",
  sent: "Your request is saved. An email alert was accepted by our notification provider.",
  failed: "Your request is saved in our consultation inbox. The email alert failed; you do not need to submit again.",
  pending: "Your request is saved in our consultation inbox. The email alert is pending; you do not need to submit again.",
};
export function ConsultationForm() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string[]>>>({});
  const [saved, setSaved] = useState<NotificationOutcome | null>(null);
  const request = useRef<{ key: string; payload: string } | null>(null);
  const submitting = useRef(false);
  const messageRef = useRef<HTMLDivElement>(null);
  function change(field: Field, value: string) { setValues(v => ({ ...v, [field]: value })); setErrors(e => ({ ...e, [field]: undefined })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); setErrors({});
    const payload = { ...values, fleetSize: Number(values.fleetSize) };
    const serialized = JSON.stringify(payload);
    if (!request.current || request.current.payload !== serialized) request.current = { key: crypto.randomUUID(), payload: serialized };
    try {
      const response = await fetch("/api/consultations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: request.current.key }) });
      const result = await response.json();
      if (!response.ok || result.saved !== true) {
        setError(result.error ?? "We couldn’t confirm your request. Your information is kept; please retry."); setErrors(result.fieldErrors ?? {});
      } else {
        setSaved(result.notification in outcomeText ? result.notification : "pending");
      }
    } catch { setError("We couldn’t confirm your request. Your information is kept. Check your connection and retry; the same request will not be saved twice."); }
    finally { submitting.current = false; setBusy(false); requestAnimationFrame(() => messageRef.current?.focus()); }
  }
  function feedback(field: Field) { return errors[field]?.length ? <span className="field-error" id={`${field}-error`}>{errors[field]?.[0]}</span> : null; }
  function props(field: Field) { return { id: field, name: field, value: values[field], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(field, e.target.value), "aria-invalid": Boolean(errors[field]?.length), "aria-describedby": errors[field]?.length ? `${field}-error` : undefined }; }
  if (saved) return <div className="consultation-success" ref={messageRef} tabIndex={-1} role="status"><p className="eyebrow">REQUEST RECEIVED</p><h2>Your next move starts here.</h2><p>{outcomeText[saved]}</p><p className="muted">No service commitment has been made. Your equipment, lanes and requirements will guide the consultation.</p><button className="button button-secondary" onClick={() => { setSaved(null); setValues(initial); request.current = null; }}>Start another request</button></div>;
  return <form method="post" onSubmit={submit} className="consultation-form" aria-busy={busy}><div className="form-heading"><p className="eyebrow">TELL US ABOUT YOUR OPERATION</p><h2>Let’s plan the work ahead.</h2><p className="muted">All fields are required. Share the details that will help us understand your dispatch needs.</p></div>
    {error && <div className="form-feedback form-error" role="alert" ref={messageRef} tabIndex={-1}>{error}</div>}
    <fieldset disabled={busy || !hydrated} className="consultation-fields"><div className="form-grid">
      <label htmlFor="contactName">Contact name<input {...props("contactName")} autoComplete="name" required minLength={2} maxLength={120} />{feedback("contactName")}</label>
      <label htmlFor="companyName">Company name<input {...props("companyName")} autoComplete="organization" required minLength={2} maxLength={160} />{feedback("companyName")}</label>
      <label htmlFor="email">Email<input {...props("email")} type="email" autoComplete="email" required maxLength={254} />{feedback("email")}</label>
      <label htmlFor="phone">Phone<input {...props("phone")} type="tel" autoComplete="tel" required maxLength={40} placeholder="Include your country code" />{feedback("phone")}</label>
      <label htmlFor="equipmentType">Equipment type<select {...props("equipmentType")} required><option value="">Choose your equipment</option>{offeredEquipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>{feedback("equipmentType")}</label>
      <label htmlFor="fleetSize">Fleet size<input {...props("fleetSize")} type="number" inputMode="numeric" min={1} max={10000} step={1} required />{feedback("fleetSize")}</label>
      <label className="form-wide" htmlFor="preferredContactMethod">Preferred contact method<select {...props("preferredContactMethod")} required><option value="EMAIL">Email</option><option value="PHONE">Phone</option></select>{feedback("preferredContactMethod")}</label>
      <label className="form-wide" htmlFor="message">What dispatch support do you need?<textarea {...props("message")} rows={5} required maxLength={4000} placeholder="Tell us about your preferred lanes, availability and priorities." />{feedback("message")}</label>
    </div><div className="form-honeypot" aria-hidden="true"><label htmlFor="website">Leave this field empty<input {...props("website")} tabIndex={-1} autoComplete="off" /></label></div>
    <p className="form-privacy muted">We use these details to review and respond to your inquiry. Please leave passwords, payment information and sensitive documents out of your message.</p><button type="submit" className="button button-primary">{busy ? "Saving your request…" : "Request a Dispatch Consultation"}</button></fieldset><noscript><p>This form needs JavaScript to submit and preserve your entries. Please enable it to send your request.</p></noscript>
  </form>;
}

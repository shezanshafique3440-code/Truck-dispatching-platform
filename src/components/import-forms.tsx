"use client";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { importColumns, importLimits, type ColumnMapping } from "@/lib/import-contract";
const subscribe = () => () => {};
export function ImportUpload({ campaigns, defaultCampaign }: { campaigns: { id: string; name: string; timezone: string }[]; defaultCampaign?: string }) {
  const router = useRouter(); const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const requestKey = useRef<string | null>(null);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setError(""); const form = new FormData(event.currentTarget); const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > importLimits.bytes || !/\.(csv|xlsx)$/i.test(file.name)) { setError("Choose a nonempty .csv or .xlsx file up to 2 MiB."); return; }
    form.set("requestKey", requestKey.current ??= crypto.randomUUID()); setBusy(true);
    try { const response = await fetch("/api/performance/imports", { method: "POST", body: form }); const result = await response.json(); if (!response.ok) { setError(result.error ?? "Unable to stage this file. Your selection is kept; retry."); return; } router.push(`/dashboard/imports/${result.id}`); router.refresh(); }
    catch { setError("Unable to confirm the upload. Your file selection is kept; retrying uses the same request key."); }
    finally { setBusy(false); }
  }
  return <form method="post" encType="multipart/form-data" className="workspace-form import-upload" onSubmit={upload} aria-busy={busy}>
    <fieldset disabled={busy || !hydrated || !campaigns.length}>
      <label htmlFor="import-campaign">Campaign<select id="import-campaign" name="campaignId" required defaultValue={defaultCampaign ?? ""} onChange={() => { requestKey.current = null; }}><option value="">Choose an assigned campaign</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name} · {c.timezone}</option>)}</select></label>
      <label htmlFor="import-file">Performance file<input id="import-file" name="file" type="file" accept=".csv,.xlsx" required onChange={() => { requestKey.current = null; }} aria-describedby="import-limits" /></label>
      <p id="import-limits" className="muted">CSV or XLSX · up to 2 MiB, 1,000 data rows and 32 columns. Upload stages a private preview; it does not create performance records.</p>
      <button className="button button-primary" type="submit">{busy ? "Preparing preview…" : "Upload and preview"}</button>
    </fieldset>{error && <p className="form-error" role="alert">{error}</p>}<noscript>This upload needs JavaScript to validate and preview the file.</noscript>
  </form>;
}
export function ImportMapping({ id, version, headers, mapping }: { id: string; version: number; headers: string[]; mapping: ColumnMapping }) {
  const router = useRouter(); const hydrated = useSyncExternalStore(subscribe, () => true, () => false); const [values, setValues] = useState(mapping); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (busy) return; setBusy(true); setError(""); try { const r = await fetch(`/api/performance/imports/${id}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, mapping: values }) }); const result = await r.json(); if (!r.ok) setError(result.error ?? "Mapping could not be saved. Your choices are kept."); else router.refresh(); } catch { setError("Connection interrupted. Your mapping choices are kept; retry."); } finally { setBusy(false); } }
  return <form method="post" className="workspace-form import-mapping" onSubmit={submit} aria-busy={busy}><fieldset disabled={busy || !hydrated}><div className="import-mapping-grid">{importColumns.map(column => <label key={column.key} htmlFor={`map-${column.key}`}>{column.label}<select id={`map-${column.key}`} value={values[column.key] ?? ""} onChange={e => setValues(v => ({ ...v, [column.key]: e.target.value === "" ? null : Number(e.target.value) }))}><option value="">Not mapped</option>{headers.map((header, index) => <option key={index} value={index}>{header} · column {index + 1}</option>)}</select><span className="field-hint">{column.description}</span></label>)}</div><button className="button button-secondary" type="submit">{busy ? "Validating rows…" : "Apply mapping and validate"}</button></fieldset>{error && <p className="form-error" role="alert">{error}</p>}</form>;
}
export function ImportConfirmation({ id, version, validRows, invalidRows, expired }: { id: string; version: number; validRows: number; invalidRows: number; expired: boolean }) {
  const router = useRouter(); const hydrated = useSyncExternalStore(subscribe, () => true, () => false); const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !confirmed) return; setBusy(true); setError("");
    try { const response = await fetch(`/api/performance/imports/${id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, confirm: true }) }); const result = await response.json(); if (!response.ok) { setError(result.error ?? "Import could not be confirmed. No partial batch was saved; retry."); if (result.reviewRequired) { setConfirmed(false); router.refresh(); } } else router.refresh(); }
    catch { setError("The result could not be confirmed. Retry safely; this batch cannot create the same records twice."); }
    finally { setBusy(false); }
  }
  return <form method="post" className="import-confirmation" onSubmit={submit} aria-busy={busy}><h2>Confirm the import</h2><p className="muted">{validRows} valid rows will become drafts. {invalidRows} invalid rows will be skipped. Existing records are never overwritten. Submission and staff approval are still required.</p>{expired ? <p className="form-error">This preview expired. Start a new upload.</p> : <><label className="import-ack"><input type="checkbox" required checked={confirmed} disabled={busy || !hydrated || validRows === 0} onChange={e => setConfirmed(e.target.checked)} />I reviewed the preview, including every page and the excluded rows, and confirm importing {validRows} valid rows as drafts.</label><button className="button button-primary" disabled={!hydrated || busy || !confirmed || validRows === 0}>{busy ? "Committing the batch…" : `Confirm ${validRows} draft records`}</button></>}{error && <p className="form-error" role="alert">{error}</p>}</form>;
}

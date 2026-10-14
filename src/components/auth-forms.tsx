"use client";
import { useState, useSyncExternalStore, useId, useRef } from "react";
import { FormFeedback } from "@/components/form-feedback";
import Link from "next/link";
import { useRouter } from "next/navigation";
function subscribeToURL(callback: () => void) { window.addEventListener("hashchange", callback); window.addEventListener("popstate", callback); return () => { window.removeEventListener("hashchange", callback); window.removeEventListener("popstate", callback); }; }
export function AuthForm({ mode }: { mode: "login" | "invite" | "forgot" | "reset" | "password" }) {
  const router = useRouter(); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const lock = useRef(false); const feedbackId = useId();
  const token = useSyncExternalStore(subscribeToURL, () => mode === "invite" ? new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "" : new URLSearchParams(window.location.search).get("token") ?? "", () => "");
  const hydrated = useSyncExternalStore(subscribeToURL, () => true, () => false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setError(""); setMessage(""); setBusy(true);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    let endpoint = "/api/auth/sign-in/email"; let body: Record<string, unknown> = { ...values, rememberMe: false, callbackURL: "/dashboard" };
    if (mode === "invite") { endpoint = "/api/invitations/accept"; body = { ...values, token }; }
    if (mode === "forgot") { endpoint = "/api/auth/request-password-reset"; body = values; }
    if (mode === "reset") { endpoint = "/api/auth/reset-password"; body = { ...values, token }; }
    if (mode === "password") { endpoint = "/api/auth/change-password"; body = values; }
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json();
      if (!response.ok) { setError(data.error ?? data.message ?? "The request could not be completed."); return; }
      if (mode !== "login") form.reset();
      if (mode === "login") { router.replace("/dashboard"); router.refresh(); }
      else if (mode === "invite") { setMessage("Your account is ready. Sign in with your new password."); window.history.replaceState(null, "", window.location.pathname); }
      else if (mode === "forgot") setMessage("If an active account matches this address, a reset email will be requested. Check your inbox.");
      else if (mode === "reset") { setMessage("Your password has been reset. Sign in again."); window.history.replaceState(null, "", window.location.pathname); }
      else setMessage("Password updated. Your other sessions have been revoked.");
    } catch { setError("Unable to connect. Your entries are kept; please try again."); } finally { lock.current = false; setBusy(false); }
  }
  if ((mode === "invite" || mode === "reset") && !hydrated) return <p role="status">Checking your link…</p>;
  if ((mode === "invite" || mode === "reset") && !token && !message) return <div className="auth-notice"><h2>A valid link is required.</h2><p>Open the invitation or password reset link shared with you. Expired or used links cannot create access.</p><Link href="/login" className="text-link">Return to sign in</Link></div>;
  return <form method="post" className="workspace-form auth-form" onSubmit={submit} aria-busy={busy} aria-describedby={error || message ? feedbackId : undefined}>
    <noscript>This secure form needs JavaScript. Enable it to continue.</noscript>
    {mode === "invite" && <label>Full name<input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>}
    {["login", "invite", "forgot"].includes(mode) && <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" /></label>}
    {mode === "password" && <label>Current password<input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" /></label>}
    {mode !== "forgot" && <label>{mode === "login" ? "Password" : "New password"}<input name={mode === "reset" || mode === "password" ? "newPassword" : "password"} type="password" required minLength={mode === "login" ? 1 : 12} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}
    {mode !== "login" && mode !== "forgot" && <p className="form-help">Use at least 12 characters. A long, unique passphrase is recommended.</p>}
    <FormFeedback id={feedbackId} message={error || message} failed={Boolean(error)} />
    {!message && <button type="submit" className="button button-primary" disabled={busy || !hydrated}>{busy ? "Please wait…" : ({ login: "Sign in to your workspace", invite: "Accept invitation", forgot: "Request password reset", reset: "Reset password", password: "Update password" }[mode])}</button>}
    {mode === "login" && <Link href="/forgot-password" className="text-link">Forgot your password?</Link>}
    {message && ["invite", "reset"].includes(mode) && <Link href="/login" className="text-link">Sign in</Link>}
  </form>;
}

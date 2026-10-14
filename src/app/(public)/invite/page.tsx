import { privatePageMetadata } from "@/lib/site-metadata";
import { AuthForm } from "@/components/auth-forms";
import { authConfigured } from "@/lib/auth-config";
export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata("Accept invitation");
export default function InvitePage() { return <main id="main-content" tabIndex={-1} className="container access-page compact-auth"><p className="eyebrow">INVITATION-ONLY ACCESS</p><h1>Join your workspace.</h1><p className="muted">Use the email address on your invitation. Your administrator assigns your role and access.</p>{authConfigured() ? <AuthForm mode="invite" /> : <p className="auth-notice">Team access is not configured yet. Contact your administrator.</p>}</main>; }

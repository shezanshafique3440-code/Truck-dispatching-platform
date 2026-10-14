import { privatePageMetadata } from "@/lib/site-metadata";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth";
import { authConfigured } from "@/lib/auth-config";
import { AuthForm } from "@/components/auth-forms";
import { EmptyState } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata("Team sign in");
export default async function LoginPage() {
  if (authConfigured() && await getCurrentActor()) redirect("/dashboard");
  return <main id="main-content" tabIndex={-1} className="container access-page auth-page"><div><p className="eyebrow">PRIVATE TEAM WORKSPACE</p><h1>A clear view of<br />the work ahead.</h1><p className="muted">Invitation-only access for administrators, managers and dispatchers.</p><div className="auth-benefits"><p>One shared workspace.</p><p>Access shaped around your role.</p><p>Your team’s work, kept private.</p></div></div><section className="auth-card" aria-label="Team sign in"><h2>Welcome back.</h2><p className="muted">Sign in with your invited account.</p>{authConfigured() ? <AuthForm mode="login" /> : <EmptyState title="Sign-in is not configured yet.">Your administrator needs to connect the workspace database and authentication settings.</EmptyState>}</section></main>;
}

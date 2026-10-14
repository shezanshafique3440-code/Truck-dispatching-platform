import { privatePageMetadata } from "@/lib/site-metadata";
import Link from "next/link";
import { AuthForm } from "@/components/auth-forms";
import { authConfigured, resetEmailConfigured } from "@/lib/auth-config";
export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata("Password recovery");
export default function ForgotPasswordPage() { return <main id="main-content" tabIndex={-1} className="container access-page compact-auth"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Reset your password.</h1>{authConfigured() && resetEmailConfigured() ? <AuthForm mode="forgot" /> : <div className="auth-notice"><h2>Password reset email is not connected.</h2><p className="muted">Online password recovery is currently unavailable. Contact your workspace administrator for help.</p></div>}<Link href="/login" className="text-link">Return to sign in</Link></main>; }

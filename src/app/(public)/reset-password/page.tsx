import { privatePageMetadata } from "@/lib/site-metadata";
import Link from "next/link";
import { AuthForm } from "@/components/auth-forms";
import { authConfigured, resetEmailConfigured } from "@/lib/auth-config";
export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata("Reset password");
export default function ResetPasswordPage() { return <main id="main-content" tabIndex={-1} className="container access-page compact-auth"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Set a new password.</h1>{authConfigured() && resetEmailConfigured() ? <AuthForm mode="reset" /> : <p className="auth-notice">Password reset email is not connected. Contact your administrator.</p>}<Link href="/login" className="text-link">Return to sign in</Link></main>; }

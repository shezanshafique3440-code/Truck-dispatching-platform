"use client";
import { ErrorState } from "@/components/page-states";
export default function PrivateError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main id="main-content" tabIndex={-1} className="container access-page"><ErrorState retry={reset} privateWorkspace /></main>; }

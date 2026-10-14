"use client";
import { ErrorState } from "@/components/page-states";
import "./globals.css";
import "./review.css";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <html lang="en"><body><main id="main-content" className="container access-page"><ErrorState retry={reset} /></main></body></html>; }

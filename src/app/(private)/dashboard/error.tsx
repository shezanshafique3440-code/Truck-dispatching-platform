"use client";
import { ErrorState } from "@/components/page-states";
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ErrorState retry={reset} privateWorkspace />; }

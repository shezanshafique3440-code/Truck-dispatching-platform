"use client";
import { useLinkStatus } from "next/link";
export function LinkProgress() { const { pending } = useLinkStatus(); return <span className={`link-progress${pending ? " is-pending" : ""}`} role="status"><span className="sr-only">{pending ? "Loading page…" : ""}</span><span aria-hidden="true">{pending ? "…" : ""}</span></span>; }

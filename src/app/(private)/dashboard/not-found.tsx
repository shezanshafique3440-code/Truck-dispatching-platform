import Link from "next/link";
export default function MissingRecord() { return <section className="page-state"><p className="eyebrow">RECORD UNAVAILABLE</p><h1>This record is not available.</h1><p className="muted">It may not exist or your current account may not have access.</p><Link className="button button-secondary" href="/dashboard">Back to overview</Link></section>; }

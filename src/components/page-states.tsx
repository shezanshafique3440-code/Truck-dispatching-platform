import Link from "next/link";
export function LoadingState({ title = "Loading your workspace…" }: { title?: string }) {
  return <section className="page-state" aria-busy="true" role="status"><p className="eyebrow">PLEASE WAIT</p><h1>{title}</h1><p className="muted">The latest permitted information is being loaded.</p><div className="loading-blocks" aria-hidden="true"><span /><span /><span /></div></section>;
}
export function ErrorState({ retry, privateWorkspace = false }: { retry: () => void; privateWorkspace?: boolean }) {
  return <section className="page-state" role="alert"><p className="eyebrow">PAGE UNAVAILABLE</p><h1>We couldn’t load this page.</h1><p className="muted">Try again when your connection is ready. If this keeps happening, contact your administrator.</p><div className="state-actions"><button className="button button-primary" onClick={retry}>Try again</button><Link className="button button-secondary" href={privateWorkspace ? "/dashboard" : "/"}>{privateWorkspace ? "Back to overview" : "Back to website"}</Link></div></section>;
}

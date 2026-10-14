import { privatePageMetadata } from "@/lib/site-metadata";
import { ButtonLink } from "@/components/ui";
export const metadata = privatePageMetadata("Page not found", "The requested page could not be found.");
export default function NotFound() { return <main id="main-content" tabIndex={-1} className="container access-page"><p className="eyebrow">404</p><h1>This route is off the map.</h1><p className="muted">The page you requested could not be found.</p><ButtonLink href="/">Back to the website</ButtonLink></main>; }

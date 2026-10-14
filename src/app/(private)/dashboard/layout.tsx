import { privatePageMetadata } from "@/lib/site-metadata";
import { requireActor } from "@/lib/auth";
import { DashboardNavigation } from "@/components/dashboard-navigation";
export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata("Team dashboard");
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  return <div className="dashboard-shell"><DashboardNavigation role={actor.role} name={actor.name} /><main id="main-content" tabIndex={-1}><div className="workspace-topline"><span>PRIVATE WORKSPACE</span><span>Access: {actor.role.toLowerCase()}</span></div>{children}</main></div>;
}

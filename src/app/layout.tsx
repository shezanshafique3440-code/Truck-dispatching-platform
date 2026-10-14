import type { Metadata } from "next";
import { company } from "@/config/company";
import { publicPageMetadata, siteDescription } from "@/lib/site-metadata";
import "./globals.css";
import "./review.css";
export const metadata: Metadata = {
  ...publicPageMetadata("Truck dispatching", siteDescription, "/"),
  title: { default: `${company.name} | Truck dispatching`, template: `%s | ${company.name}` },
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a href="#main-content" className="skip-link">Skip to content</a>{children}</body></html>;
}

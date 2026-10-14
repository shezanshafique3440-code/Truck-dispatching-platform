import type { NextConfig } from "next";
const config: NextConfig = {
  // Docker uses its minimal server; preserve the existing npm build/start workflow.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  async headers() {
    const base = [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ] }];
    const privatePaths = ["/dashboard/:path*", "/api/:path*", "/login", "/invite", "/forgot-password", "/reset-password"];
    return [...base, ...privatePaths.map(source => ({ source, headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "private, no-store" }] }))];
  },
};
export default config;

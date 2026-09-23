import path from "node:path";
import type { NextConfig } from "next";
const config: NextConfig = {
  turbopack: { root: path.resolve(process.cwd()) },
  serverExternalPackages: [
    "sharp",
    "archiver",
    "@remotion/renderer",
    "@remotion/bundler",
  ],
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;

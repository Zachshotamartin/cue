import { withWorkflow } from "workflow/next";
import path from "node:path";
import type { NextConfig } from "next";
const config: NextConfig = {
  turbopack: { root: path.resolve(process.cwd(), "../..") },
  serverExternalPackages: [
    "sharp",
    "pg",
    "ffmpeg-static",
    "ffprobe-static",
    "archiver",
    "@remotion/renderer",
    "@remotion/bundler",
  ],
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  outputFileTracingExcludes:
    process.platform === "linux"
      ? {
          "/*": [
            "../../node_modules/ffprobe-static/bin/darwin/**",
            "../../node_modules/ffprobe-static/bin/win32/**",
            "../../node_modules/ffprobe-static/bin/linux/ia32/**",
            "../../.data/**",
            "../../.test-data/**",
            "../../.env*",
          ],
        }
      : { "/*": ["../../.data/**", "../../.test-data/**", "../../.env*"] },
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
export default withWorkflow(config);

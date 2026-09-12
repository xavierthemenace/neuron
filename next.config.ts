import path from "node:path";
import type { NextConfig } from "next";

/**
 * `STATIC_EXPORT=1 npm run build` writes a plain folder of files to `out/`.
 *
 * Nothing in this app needs a server: one route, rendered on the client,
 * reading and writing IndexedDB. Keeping the export behind a flag rather than
 * making it the default leaves `next start` working, which is what the browser
 * test suite runs against.
 */
const nextConfig: NextConfig = {
  output: process.env.STATIC_EXPORT ? "export" : undefined,
  turbopack: {
    // This project sits inside a larger git repo with stray lockfiles above it.
    // Pinning the root stops Turbopack inferring a workspace further up.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

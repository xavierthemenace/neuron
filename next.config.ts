import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // This project sits inside a larger git repo with stray lockfiles above it.
    // Pinning the root stops Turbopack inferring a workspace further up.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

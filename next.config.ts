import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@unicitylabs/sphere-sdk",
    "ws",
    "pg",
  ],
  // Silence multi-lockfile monorepo root inference when parent dirs have package-lock.json
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

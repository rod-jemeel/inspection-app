import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    optimizePackageImports: ["hugeicons-react"],
  },
};

export default nextConfig;

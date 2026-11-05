import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 避免 Next 因上层目录的其他 lockfile 误判 workspace root
  outputFileTracingRoot: process.cwd(),
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;

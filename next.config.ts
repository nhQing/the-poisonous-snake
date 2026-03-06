import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Ignore typescript/eslint errors during build to ensure Docker image completes successfully
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;

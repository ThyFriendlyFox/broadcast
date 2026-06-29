import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "prisma"],
  eslint: {
    // Don't fail production builds on lint errors; lint is run separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

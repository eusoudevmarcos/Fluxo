import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.51"],
  devIndicators: false,
  transpilePackages: [
    "@ocean/shared",
    "@ocean/design-tokens",
    "@ocean/api-client",
  ],
};

export default nextConfig;

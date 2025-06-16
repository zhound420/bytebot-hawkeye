import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@bytebot/shared"],
  async rewrites() {
    return [
      {
        source: "/api/proxy/websockify",
        destination: "http://localhost:9990/websockify",
      },
    ];
  },
};

export default nextConfig;

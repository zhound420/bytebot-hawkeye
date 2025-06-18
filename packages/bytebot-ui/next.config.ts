import type { NextConfig } from "next";
import dotenv from "dotenv";

dotenv.config();

const nextConfig: NextConfig = {
  transpilePackages: ["@bytebot/shared"],
  async rewrites() {
    return [
      {
        source: "/api/proxy/websockify",
        destination: process.env.BYTEBOT_DESKTOP_VNC_URL!,
      },
    ];
  },
};

export default nextConfig;

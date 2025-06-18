import type { NextConfig } from "next";
import dotenv from "dotenv";

dotenv.config();

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@bytebot/shared"],
};

export default nextConfig;

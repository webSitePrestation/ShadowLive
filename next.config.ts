import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '192.168.75.152', '*.trycloudflare.com'],
};

export default nextConfig;

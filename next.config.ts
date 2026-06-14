import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 明确指定项目根目录，避免检测到上层目录的 lockfile
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.music.126.net",
      },
      {
        protocol: "https",
        hostname: "**.p1.music.126.net",
      },
    ],
  },
};

export default nextConfig;

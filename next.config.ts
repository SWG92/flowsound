import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 明确指定项目根目录，避免检测到上层目录的 lockfile
  outputFileTracingRoot: __dirname,
  // 路由导航启用 React View Transitions：页面切换获得系统级过渡动画
  // （Chrome/Edge 完整支持，其他浏览器自动降级为直接切换）
  experimental: {
    viewTransition: true,
  },
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

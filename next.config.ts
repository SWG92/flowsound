import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 明确指定项目根目录，避免检测到上层目录的 lockfile
  outputFileTracingRoot: __dirname,
  // 路由导航启用 React View Transitions：页面切换获得系统级过渡动画
  // （Chrome/Edge 完整支持，其他浏览器自动降级为直接切换）
  experimental: {
    viewTransition: true,
  },
  // 说明：封面图全部用原生 <img> 直连加载（已加 ?param= 尺寸缩放与懒加载），
  // 未使用 next/image，因此无需 images.remotePatterns 配置
};

export default nextConfig;

"use client";

import { useEffect, useState } from "react";
import { getDesktop } from "@/lib/desktop";

/**
 * Web 进场动画：应用每次加载（首次进入/刷新）的品牌过渡屏。
 * SSR 直出 → 首帧即有画面，随后淡出露出应用；overlay 始终 pointer-events-none，
 * 不阻塞任何交互，路由切换不重播（ClientWrapper 跨路由持久）。
 * 桌面壳有自己的原生启动屏（desktop/splash.html）：preload 已在首帧前给
 * <html> 打上 fs-desktop 标记，此组件被 CSS 隐藏，水合后直接卸载，不会双重播放。
 */
export function AppSplash() {
  // 桌面壳 preload 已给 <html> 打 fs-desktop 标记：初始 phase=done 直接 return null，
  // 避免 effect 里同步 setState 触发 React 19 purity 规则警告
  const [phase, setPhase] = useState<"show" | "fade" | "done">(() => getDesktop() ? "done" : "show");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fade"), 1300);
    const t2 = setTimeout(() => setPhase("done"), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className="app-splash pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-background transition-opacity duration-500"
      style={{ opacity: phase === "fade" ? 0 : 1 }}
    >
      <div className="flex flex-col items-center">
        <div className="fs-splash-icon-wrap">
          <img src="/icon-512.svg" alt="FlowSound" className="fs-splash-icon" />
        </div>
        <div className="fs-splash-brand gradient-text">FlowSound</div>
        <div className="fs-splash-tagline">让音乐流动起来</div>
        <div className="fs-splash-eq">
          <span /><span /><span /><span /><span />
        </div>
      </div>
    </div>
  );
}

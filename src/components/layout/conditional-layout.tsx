"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayQueue } from "@/components/player/queue";
import { DesktopWindowControls } from "@/components/electron/desktop-title-bar";
import { useNavTracker } from "@/hooks/use-nav-tracker";

function MainLayout({ children }: { children: React.ReactNode }) {
  useNavTracker();
  return (
    <>
      {/* 桌面壳窗口控制按钮（悬浮右上，浏览器端不渲染） */}
      <DesktopWindowControls />
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden" style={{ paddingBottom: "calc(84px + var(--safe-bottom))" }}>
        <TopNav />
        {/* 内容磨砂面板：文字铺在柔和渐变上会发糊——统一垫一层磨砂底保证对比度 */}
        <div className="flex-1 overflow-y-auto px-2 md:px-4 pb-1">
          <div className="mx-auto max-w-[1500px] min-h-full rounded-2xl bg-card/45 backdrop-blur-md border border-white/20 dark:border-white/10 px-3 md:px-6 py-4 md:py-6">
            {children}
          </div>
        </div>
      </main>
      <PlayerBar />
      <PlayQueue />
    </>
  );
}

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 桌面歌词窗路由：独立渲染进程专用，必须裸渲染（透明底 + 单行歌词）——
  // 若套主界面布局，侧栏/播放栏/窗口控制会被整个塞进 680x140 的小窗
  if (pathname === "/desktop-lyrics") return <>{children}</>;
  return <MainLayout>{children}</MainLayout>;
}

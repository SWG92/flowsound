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
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        {/* 内容磨砂面板：铺满 main 全区（含播放栏背后）——渐变不再从面板与播放栏之间的缝隙漏出。
            内层 h-full：给 flex 填充页（漫游/发现）一条确定高度链，页面自身不滚、歌单内部滚；
            长内容页（设置）内容自然溢出内层，由本层滚动。
            底部留白 92px = 播放栏顶边——列表行正好流到栏顶为止，中间不留空带
            （留白大于栏顶会出现一条发白的空面板带；calc 的 + 必须带空格，Tailwind 用下划线） */}
        <div className="flex-1 overflow-y-auto bg-card/45 backdrop-blur-md pb-[calc(92px_+_var(--safe-bottom))]">
          <div className="h-full flex flex-col max-w-[1500px] mx-auto px-3 md:px-6 pt-4 md:pt-6">
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

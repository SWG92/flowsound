"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayQueue } from "@/components/player/queue";
import { DesktopWindowControls } from "@/components/electron/desktop-title-bar";
import { useNavTracker } from "@/hooks/use-nav-tracker";
import { usePlayerStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** flex 填充页：内层给确定高度（h-full），页面自身不滚、歌单内部滚。
    其余页（设置/歌单/黑名单/歌手/专辑等长内容页）：内层 min-h-full，
    内容撑高后由面板滚动，底部 padding 保证滚到头仍停在播放栏上方 */
const FILL_PATHS = new Set(["/", "/roaming", "/history", "/favorites", "/daily"]);

function MainLayout({ children }: { children: React.ReactNode }) {
  useNavTracker();
  const pathname = usePathname();
  const fill = FILL_PATHS.has(pathname);
  // 播放栏是否在渲染：决定底部是否预留 92px 空间——
  // 未播放时不预留，避免底部出现一条空白横条隔断歌词/内容
  const hasPlayer = usePlayerStore((s) => !!s.currentSong || s.isLoading);
  return (
    <>
      {/* 桌面壳窗口控制按钮（悬浮右上，浏览器端不渲染） */}
      <DesktopWindowControls />
      <Sidebar />
      {/* main 与 Sidebar 顶部/底部/右边对齐（都是 12px 呼吸），
          左边紧贴 Sidebar（mr-0），圆角与侧栏统一 */}
      <main className="flex-1 flex flex-col m-3 ml-0 mr-3 rounded-[28px] overflow-hidden">
        <TopNav />
        {/* 内容磨砂面板：铺满 main 全区（含播放栏背后）——渐变不再从面板与播放栏之间的缝隙漏出。
            底部留白 92px（=播放栏顶边）挂在内层 padding 上：长页滚到头停在栏顶上方，
            填充页列表正好流到栏顶（min-h-full 会被大列表内容撑爆，无法两用，故按路由分流；
            calc 的 + 必须带空格，Tailwind 用下划线） */}
        <div className="flex-1 overflow-y-auto bg-card/45 backdrop-blur-md">
          <div
            className={cn(
              "flex flex-col max-w-[1500px] mx-auto px-3 md:px-6 pt-4 md:pt-6",
              hasPlayer ? "pb-[calc(92px_+_var(--safe-bottom))]" : "pb-4",
              fill ? "h-full" : "min-h-full"
            )}
          >
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

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayQueue } from "@/components/player/queue";
import { DesktopWindowControls } from "@/components/electron/desktop-title-bar";
import { getDesktop } from "@/lib/desktop";
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
        <div className="flex-1 overflow-y-auto px-2 md:px-4">{children}</div>
      </main>
      <PlayerBar />
      <PlayQueue />
    </>
  );
}

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDesktopLyrics = pathname === "/lyrics-desktop" || pathname === "/lyrics-bar";
  // 桌面壳内的悬浮歌词窗：容器背景透明（原生窗口本身透明）
  const [shell, setShell] = useState(false);
  useEffect(() => {
    if (getDesktop()) setShell(true);
  }, []);

  if (isDesktopLyrics) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: shell ? "#101018" : "rgba(0,0,0,0.85)",
          color: "#fff",
          margin: 0,
          padding: 0,
        }}
      >
        {children}
      </div>
    );
  }

  return <MainLayout>{children}</MainLayout>;
}

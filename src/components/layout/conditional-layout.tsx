"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayQueue } from "@/components/player/queue";
import { FloatingLyrics } from "@/components/player/floating-lyrics";
import { useNavTracker } from "@/hooks/use-nav-tracker";

function MainLayout({ children }: { children: React.ReactNode }) {
  useNavTracker();
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden pb-20">
        <TopNav />
        <div className="flex-1 overflow-y-auto px-4">{children}</div>
      </main>
      <PlayerBar />
      <PlayQueue />
      <FloatingLyrics />
    </>
  );
}

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDesktopLyrics = pathname === "/lyrics-desktop";

  if (isDesktopLyrics) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "rgba(0,0,0,0.85)",
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

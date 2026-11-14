"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/lib/store";

// Electron 壳的媒体键桥接：主进程拦截键盘 Media* 全局键后经 IPC 转发到这里，
// 直接驱动播放器 store。浏览器环境没有 window.flowsoundDesktop，零开销跳过。
export function DesktopMediaBridge() {
  useEffect(() => {
    const desktop = (
      window as unknown as {
        flowsoundDesktop?: { onMediaCommand(cb: (cmd: string) => void): void };
      }
    ).flowsoundDesktop;
    if (!desktop) return;

    desktop.onMediaCommand((cmd) => {
      const s = usePlayerStore.getState();
      if (cmd === "playpause") s.togglePlay();
      else if (cmd === "next") s.nextSong();
      else if (cmd === "prev") s.prevSong();
    });
  }, []);

  return null;
}

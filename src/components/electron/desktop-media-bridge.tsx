"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/lib/store";
import { getDesktop } from "@/lib/desktop";

/**
 * Electron 桌面壳桥接：
 * - 媒体键命令（主进程全局快捷键 → 播放器 store）
 * - 关闭行为偏好同步（设置页写 localStorage，挂载时上报主进程）
 * - 任务栏进度条（播放秒级节流上报）
 * - 托盘播放态（图标切换 + tooltip 歌名）
 * 浏览器环境 getDesktop() 为 null，全部零开销跳过。
 */
export function DesktopMediaBridge() {
  useEffect(() => {
    const d = getDesktop();
    if (!d) return;

    // 关闭行为：挂载时把本地偏好同步给主进程
    try {
      d.setCloseAction(
        localStorage.getItem("flowsound_close_action") === "exit" ? "exit" : "tray"
      );
    } catch { /* ignore */ }

    // 任务栏进度 + 托盘状态（变化时才上报）
    let lastSec = -1;
    let lastPlaying: boolean | null = null;
    let lastTitle = "";
    const unsub = usePlayerStore.subscribe((s) => {
      if (s.currentSong && s.duration > 0) {
        const sec = Math.floor(s.currentTime);
        if (sec !== lastSec) {
          lastSec = sec;
          d.setProgress(Math.min(1, s.currentTime / s.duration));
        }
      } else if (lastSec !== -1) {
        lastSec = -1;
        d.setProgress(-1);
      }
      const title = s.currentSong
        ? `${s.currentSong.name} - ${s.currentSong.artists?.[0]?.name ?? ""}`.trim()
        : "";
      if (s.isPlaying !== lastPlaying || title !== lastTitle) {
        lastPlaying = s.isPlaying;
        lastTitle = title;
        d.setTrayState({ playing: s.isPlaying, title });
      }
    });
    return unsub;
  }, []);

  return null;
}

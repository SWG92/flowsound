"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/lib/store";
import { getDesktop } from "@/lib/desktop";
import { getCoverUrl } from "@/lib/utils";

/**
 * Electron 桌面壳桥接：
 * - 媒体键命令（主进程全局快捷键 → 播放器 store）
 * - 关闭行为偏好同步（设置页写 localStorage，挂载时上报主进程）
 * - 任务栏进度条（播放秒级节流上报）
 * - 托盘播放态（图标切换 + tooltip 歌名）
 * - 常用路由预取（防快速点击侧栏时 RSC 请求互相中止触发整页硬刷新）
 * 浏览器环境 getDesktop() 为 null，全部零开销跳过。
 */

const PREFETCH_ROUTES = ["/", "/daily", "/favorites", "/history", "/playlist", "/blacklist", "/search"];

export function DesktopMediaBridge() {
  const router = useRouter();

  // 路由预取：桌面壳内挂载即预取 + 每 30s 保活。
  // 快速连点侧栏时，App Router 会中止上一次 RSC 请求（net::ERR_ABORTED），
  // Next 对中止/失败的导航会降级成整页硬刷新 → 播放器随之停摆；
  // 预取后点击直接命中本地缓存，不再发起竞争请求。
  useEffect(() => {
    if (!getDesktop()) return;
    const prefetchAll = () => {
      for (const r of PREFETCH_ROUTES) {
        try { router.prefetch(r); } catch { /* ignore */ }
      }
    };
    prefetchAll();
    const t = setInterval(prefetchAll, 30000);
    return () => clearInterval(t);
  }, [router]);

  // 系统媒体面板集成（Windows 音量浮层/SMTC、Chrome 媒体中心）：
  // 显示歌名/歌手/封面，面板内可直接播放/暂停/切歌。
  // 硬件媒体键仍走主进程全局快捷键；面板按钮走 SMTC 动作处理器，二者并存不冲突。
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    // 元数据跟随当前歌曲
    const unsubSong = usePlayerStore.subscribe((s, prev) => {
      if (s.currentSong === prev.currentSong) return;
      if (!s.currentSong) {
        ms.metadata = null;
        return;
      }
      const cover = getCoverUrl(s.currentSong);
      ms.metadata = new MediaMetadata({
        title: s.currentSong.name,
        artist: s.currentSong.artists?.map((a) => a.name).join(" / "),
        album: "FlowSound",
        artwork: cover ? [{ src: `${cover}?param=512y512`, sizes: "512x512" }] : [],
      });
    });

    // 面板按钮 → 播放器动作
    try {
      ms.setActionHandler("play", () => usePlayerStore.getState().setPlaying(true));
      ms.setActionHandler("pause", () => usePlayerStore.getState().setPlaying(false));
      ms.setActionHandler("previoustrack", () => usePlayerStore.getState().prevSong());
      ms.setActionHandler("nexttrack", () => usePlayerStore.getState().nextSong());
    } catch { /* 个别平台不支持个别动作时忽略 */ }

    // 播放状态同步（面板上的 播放/暂停 图标）
    const unsubState = usePlayerStore.subscribe((s, prev) => {
      if (s.isPlaying === prev.isPlaying) return;
      try {
        ms.playbackState = s.isPlaying ? "playing" : "paused";
      } catch { /* ignore */ }
    });

    return () => {
      unsubSong();
      unsubState();
    };
  }, []);

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

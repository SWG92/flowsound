"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/lib/store";
import { getDesktop } from "@/lib/desktop";
import { getCoverUrl } from "@/lib/utils";
import { useDominantColor } from "@/hooks/use-dominant-color";

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
  // 专辑主色：桌面歌词窗文字浸染色（与全屏页/播放栏共用取色缓存）
  const currentSong = usePlayerStore((s) => s.currentSong);
  const accent = useDominantColor(currentSong ? getCoverUrl(currentSong) : null);

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

  // 桌面歌词窗数据广播：当前歌词行（含译文，按翻译开关过滤）+ 专辑主色。
  // 歌词窗未打开时频道无监听者，消息自然丢弃，开销可忽略
  useEffect(() => {
    if (!getDesktop()) return; // 浏览器端没有歌词窗
    const ch = new BroadcastChannel("flowsound-lyrics");
    const publish = () => {
      const s = usePlayerStore.getState();
      const line = s.lyrics[s.currentLyricIndex];
      if (!line) {
        ch.postMessage({ text: s.currentSong ? s.currentSong.name : "", accent: accent ?? undefined });
        return;
      }
      ch.postMessage({
        text: line.text,
        trans: s.lyricTrans && line.transText ? line.transText : undefined,
        accent: accent ?? undefined,
      });
    };
    publish();
    // 歌词窗打开时会发 sync 请求：立即补发当前行（否则要等下一次歌词变化才同步）
    ch.onmessage = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === "sync") publish();
    };
    const unsub = usePlayerStore.subscribe((s, prev) => {
      if (
        s.currentLyricIndex !== prev.currentLyricIndex ||
        s.lyrics !== prev.lyrics ||
        s.currentSong !== prev.currentSong ||
        s.lyricTrans !== prev.lyricTrans
      ) {
        publish();
      }
    });
    return () => {
      unsub();
      ch.close();
    };
  }, [accent]);

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

"use client";

import { useEffect, useState } from "react";
import { Minus, Square, X, Copy } from "lucide-react";
import { usePlayerStore } from "@/lib/store";
import { getDesktop } from "@/lib/desktop";

/**
 * 桌面壳自绘标题栏（汽水音乐同款集成式顶栏）：
 * - 无框窗口 + 本组件替代系统标题栏；整条为拖拽区（双击最大化），按钮 no-drag
 * - 左：当前播放「歌名 - 歌手」；右：最小化 / 最大化还原 / 关闭（关闭行为跟随设置）
 * - 浏览器环境不渲染（getDesktop 为 null）
 */
export function DesktopTitleBar() {
  const [shell, setShell] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    const d = getDesktop();
    if (!d) return;
    setShell(true);
    // 挂上壳标记：globals.css 据此整体下移布局（body padding / 侧栏 / 队列 / 全屏页偏移）
    document.documentElement.classList.add("desktop-shell");
    d.onWindowState?.((s) => setMaximized(!!s?.maximized));
  }, []);

  if (!shell) return null;

  const title = currentSong
    ? `${currentSong.name}${currentSong.artists?.length ? " - " + currentSong.artists.map((a) => a.name).join(" / ") : ""}`
    : "FlowSound — 让音乐流动起来";

  return (
    <div
      className="app-drag fixed top-0 inset-x-0 h-10 z-[130] flex items-center select-none"
      style={{
        background: "color-mix(in srgb, var(--background) 72%, transparent)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        borderBottom: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
      }}
    >
      {/* 当前播放信息（纯拖拽区） */}
      <div className="flex items-center gap-2 pl-4 min-w-0 flex-1">
        {currentSong && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: isPlaying ? "var(--primary)" : "var(--muted-foreground)",
              boxShadow: isPlaying ? "0 0 8px var(--primary)" : "none",
            }}
          />
        )}
        <span className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
          {title}
        </span>
      </div>

      {/* 窗口控制按钮 */}
      <div className="app-no-drag flex items-stretch h-10 shrink-0">
        <button
          onClick={() => getDesktop()?.windowMinimize()}
          title="最小化"
          className="w-11 flex items-center justify-center cursor-pointer transition-colors hover:bg-foreground/10"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={() => getDesktop()?.windowMaxToggle()}
          title={maximized ? "还原" : "最大化"}
          className="w-11 flex items-center justify-center cursor-pointer transition-colors hover:bg-foreground/10"
          style={{ color: "var(--muted-foreground)" }}
        >
          {maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>
        <button
          onClick={() => getDesktop()?.windowClose()}
          title="关闭"
          className="w-12 flex items-center justify-center cursor-pointer transition-colors hover:bg-red-500 hover:text-white"
          style={{ color: "var(--muted-foreground)" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

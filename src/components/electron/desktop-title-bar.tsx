"use client";

import { useEffect, useState } from "react";
import { Minus, Square, X, Copy } from "lucide-react";
import { getDesktop } from "@/lib/desktop";

/**
 * 桌面壳窗口控制按钮（汽水音乐同款）：
 * 不设独立标题横栏——按钮组悬浮在内容区右上角，窗口拖拽区由页面自身
 * 顶部的自然留白承担（TopNav 行 + 侧栏头部，见 globals.css 壳样式）。
 * 浏览器环境不渲染。
 */
export function DesktopWindowControls() {
  const [shell, setShell] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const d = getDesktop();
    if (!d) return;
    setShell(true);
    // 挂上壳标记：globals.css 据此启用桌面壳专属样式（拖拽区等，不做布局位移）
    document.documentElement.classList.add("desktop-shell");
    d.onWindowState?.((s) => setMaximized(!!s?.maximized));
  }, []);

  if (!shell) return null;

  return (
    <div className="app-no-drag fixed top-2.5 right-3 z-[200] flex items-center gap-0.5">
      <button
        onClick={() => getDesktop()?.windowMinimize()}
        title="最小化"
        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-foreground/10"
        style={{ color: "var(--muted-foreground)" }}
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        onClick={() => getDesktop()?.windowMaxToggle()}
        title={maximized ? "还原" : "最大化"}
        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-foreground/10"
        style={{ color: "var(--muted-foreground)" }}
      >
        {maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
      </button>
      <button
        onClick={() => getDesktop()?.windowClose()}
        title="关闭"
        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-red-500 hover:text-white"
        style={{ color: "var(--muted-foreground)" }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

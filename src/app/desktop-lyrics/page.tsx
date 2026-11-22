"use client";

import { useEffect, useState } from "react";
import { X, Lock } from "lucide-react";
import { getDesktop } from "@/lib/desktop";

/**
 * 桌面歌词窗（原生透明小窗，由主进程创建）。
 * 数据来源：主窗口经 BroadcastChannel("flowsound-lyrics") 推送当前歌词行
 * { text, trans?, accent? }——独立渲染进程没有共享 store，走广播同步。
 * 整窗可拖动（app-region），悬停右上角出现关闭按钮。
 */
interface LyricPayload {
  text?: string;
  trans?: string;
  accent?: string;
}

// 字号三档（挂载后从 localStorage 恢复，避免 SSR/水合不一致）
const FONT_SIZES = { s: 24, m: 30, l: 40 } as const;
const FONT_ORDER = [FONT_SIZES.s, FONT_SIZES.m, FONT_SIZES.l] as const;

export default function DesktopLyricsPage() {
  const [line, setLine] = useState<LyricPayload>({ text: "" });
  const [fontSize, setFontSize] = useState<number>(FONT_SIZES.m);

  // 恢复上次字号
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("flowsound_lyrics_fontsize"));
      if (FONT_ORDER.includes(v as (typeof FONT_ORDER)[number])) setFontSize(v);
    } catch { /* ignore */ }
  }, []);

  const cycleFont = () => {
    const idx = FONT_ORDER.indexOf(fontSize as (typeof FONT_ORDER)[number]);
    const next = FONT_ORDER[(idx + 1) % FONT_ORDER.length];
    setFontSize(next);
    try { localStorage.setItem("flowsound_lyrics_fontsize", String(next)); } catch { /* ignore */ }
  };

  // 标记透明底：抹掉根布局的渐变背景与光斑（见 globals.css 桌面歌词窗一节）
  useEffect(() => {
    document.documentElement.classList.add("desktop-lyrics");
    return () => document.documentElement.classList.remove("desktop-lyrics");
  }, []);

  useEffect(() => {
    const ch = new BroadcastChannel("flowsound-lyrics");
    ch.onmessage = (e: MessageEvent) => {
      setLine((e.data as LyricPayload) ?? { text: "" });
    };
    // 空数据兜底：主窗口未推送时显示占位
    ch.postMessage({ text: "等待播放…" });
    return () => ch.close();
  }, []);

  return (
    <div className="desktop-lyrics-root">
      <div className="desktop-lyrics-tools">
        <button
          onClick={cycleFont}
          title="切换字号"
          className="px-1.5 rounded-full text-xs font-bold text-white/70 hover:text-white hover:bg-black/30 cursor-pointer bg-black/20 h-[22px]"
        >
          Aa
        </button>
        <button
          onClick={() => getDesktop()?.setLyricsLocked(true)}
          title="锁定（鼠标穿透防误点，托盘菜单可解锁）"
          className="p-1 rounded-full text-white/70 hover:text-white hover:bg-black/30 cursor-pointer bg-black/20"
        >
          <Lock className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => getDesktop()?.closeLyricsWindow()}
          title="关闭桌面歌词"
          className="p-1 rounded-full text-white/70 hover:text-white hover:bg-black/30 cursor-pointer bg-black/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p
        className={cnLine(line)}
        style={{
          fontSize: `${fontSize}px`,
          ...(line.accent ? ({ "--lyrics-accent": line.accent } as React.CSSProperties) : undefined),
        }}
      >
        {line.text || "FlowSound"}
      </p>
      {line.trans && <p className="desktop-lyrics-trans">{line.trans}</p>}
    </div>
  );
}

function cnLine(line: LyricPayload): string {
  return line.accent ? "desktop-lyrics-line has-accent" : "desktop-lyrics-line";
}

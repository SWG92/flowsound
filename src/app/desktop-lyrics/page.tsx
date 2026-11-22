"use client";

import { useEffect, useState, useRef } from "react";
import { X, Lock, LockOpen } from "lucide-react";
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
  // 锁定 = 整窗鼠标穿透（看得见点不了）。交互模型：
  // 锁定时鼠标移动事件仍转发（forward: true），页面据此检测光标——
  // 光标进入右上角工具条区域 → 临时恢复鼠标（工具条可点）；离开 → 重新穿透。
  // 🔓 按钮 = 彻底解锁。解锁入口：工具条 + 托盘菜单 + 播放栏按钮三处
  const rootRef = useRef<HTMLDivElement>(null);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const inZoneRef = useRef(false);
  const appliedRef = useRef(false); // 最近一次下发给主进程的穿透状态（去重 IPC）

  const applyIgnore = (ignore: boolean) => {
    if (appliedRef.current === ignore) return;
    appliedRef.current = ignore;
    getDesktop()?.setLyricsLocked(ignore);
  };

  const handleLockToggle = () => {
    const next = !lockedRef.current;
    lockedRef.current = next;
    setLocked(next);
    inZoneRef.current = false;
    appliedRef.current = false;
    applyIgnore(next);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!lockedRef.current) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    // 工具条热区：右上角 150x56
    const inZone = e.clientX > rect.right - 150 && e.clientY < rect.top + 56;
    if (inZone !== inZoneRef.current) {
      inZoneRef.current = inZone;
      applyIgnore(!inZone);
    }
  };

  // 恢复上次字号（延后一拍，避免 effect 内同步 setState 级联渲染告警）
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = Number(localStorage.getItem("flowsound_lyrics_fontsize"));
        if (FONT_ORDER.includes(v as (typeof FONT_ORDER)[number])) setFontSize(v);
      } catch { /* ignore */ }
    }, 0);
    return () => clearTimeout(t);
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
    <div ref={rootRef} className="desktop-lyrics-root" onMouseMove={handleMouseMove}>
      <div className="desktop-lyrics-tools">
        <button
          onClick={cycleFont}
          title="切换字号"
          className="px-1.5 rounded-full text-xs font-bold text-white/70 hover:text-white hover:bg-black/30 cursor-pointer bg-black/20 h-[22px]"
        >
          Aa
        </button>
        <button
          onClick={handleLockToggle}
          title={locked ? "解锁桌面歌词" : "锁定（鼠标穿透防误点；光标移到本工具条可解锁）"}
          className="p-1 rounded-full text-white/70 hover:text-white hover:bg-black/30 cursor-pointer bg-black/20"
        >
          {locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
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

"use client";

import { useEffect, useState, useRef } from "react";
import { X, Lock, LockOpen } from "lucide-react";
import { getDesktop } from "@/lib/desktop";

/**
 * 桌面歌词窗（原生透明小窗，由主进程创建）。
 * 形态与其他播放器一致：深色玻璃胶囊、常驻工具条（字号/锁定/关闭）。
 * 数据来源：主窗口经 BroadcastChannel("flowsound-lyrics") 推送当前歌词行。
 *
 * 拖拽（LX Music 同款）：渲染层监听鼠标算 delta → IPC → 主进程 setBounds。
 * 不用 -webkit-app-region：透明窗 + 鼠标穿透场景下不可靠。
 * 锁定 = 整窗鼠标穿透（setIgnoreMouseEvents true + forward）——穿透时 mousemove
 * 事件仍转发给页面，因此拖拽在锁定状态下照常工作；工具条热区（右上角 150x56）
 * 悬停 → 临时恢复鼠标（可点 🔓 解锁）。解锁入口：工具条 🔓 / 托盘菜单。
 */
interface LyricPayload {
  text?: string;
  trans?: string;
  accent?: string;
}

const FONT_SIZES = { s: 24, m: 30, l: 40 } as const;
const FONT_ORDER = [FONT_SIZES.s, FONT_SIZES.m, FONT_SIZES.l] as const;

export default function DesktopLyricsPage() {
  const [line, setLine] = useState<LyricPayload>({ text: "" });
  const [fontSize, setFontSize] = useState<number>(FONT_SIZES.m);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const inZoneRef = useRef(false);
  const appliedRef = useRef(false); // 最近一次下发给主进程的穿透状态（去重 IPC）
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // 标记透明底：抹掉根布局的渐变背景与光斑（见 globals.css 桌面歌词窗一节）
  useEffect(() => {
    document.documentElement.classList.add("desktop-lyrics");
    return () => document.documentElement.classList.remove("desktop-lyrics");
  }, []);

  // 歌词数据：主窗口经 BroadcastChannel 推送当前行；打开时先请求一次同步
  useEffect(() => {
    const ch = new BroadcastChannel("flowsound-lyrics");
    ch.onmessage = (e: MessageEvent) => {
      const data = e.data as LyricPayload & { type?: string };
      if (data?.type === "sync") return;
      setLine(data ?? { text: "" });
    };
    ch.postMessage({ type: "sync" });
    return () => ch.close();
  }, []);

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

  // 穿透状态下发（去重：状态没变不重复发 IPC）
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return; // 工具条按钮不启动拖拽
    dragRef.current = { x: e.screenX, y: e.screenY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 拖拽（锁定穿透时 mousemove 仍转发，照常可拖）
    if (dragRef.current) {
      const dx = e.screenX - dragRef.current.x;
      const dy = e.screenY - dragRef.current.y;
      dragRef.current = { x: e.screenX, y: e.screenY };
      if (dx || dy) getDesktop()?.moveLyricsWindowBy(dx, dy);
    }
    // 锁定中：光标进入工具条热区（右上角 150x56）→ 临时恢复鼠标；离开 → 重新穿透
    if (!lockedRef.current) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const inZone = e.clientX > rect.right - 150 && e.clientY < rect.top + 56;
    if (inZone !== inZoneRef.current) {
      inZoneRef.current = inZone;
      applyIgnore(!inZone);
    }
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={rootRef}
      className="desktop-lyrics-root"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => (dragRef.current = null)}
    >
      <div className="desktop-lyrics-pill">
        {/* 常驻工具条（右上角） */}
        <div className="desktop-lyrics-tools">
          <button onClick={cycleFont} title="切换字号" className="desktop-lyrics-chip text-xs font-bold">
            Aa
          </button>
          <button
            onClick={handleLockToggle}
            title={locked ? "解锁桌面歌词" : "锁定（鼠标穿透防误点，托盘菜单也可解锁）"}
            className="desktop-lyrics-chip"
          >
            {locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => getDesktop()?.closeLyricsWindow()}
            title="关闭桌面歌词"
            className="desktop-lyrics-chip"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p
          className={line.accent ? "desktop-lyrics-line has-accent" : "desktop-lyrics-line"}
          style={{
            fontSize: `${fontSize}px`,
            ...(line.accent ? ({ "--lyrics-accent": line.accent } as React.CSSProperties) : undefined),
          }}
        >
          {line.text || "FlowSound"}
        </p>
        {line.trans && <p className="desktop-lyrics-trans">{line.trans}</p>}
      </div>
    </div>
  );
}

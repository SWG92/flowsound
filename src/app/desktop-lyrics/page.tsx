"use client";

import { useEffect, useState, useRef } from "react";
import { X, Lock, LockOpen } from "lucide-react";
import { getDesktop } from "@/lib/desktop";

/**
 * 桌面歌词窗（原生透明小窗，由主进程创建）。
 * 形态与其他播放器一致：深色玻璃胶囊、常驻工具条（字号/锁定/关闭）、整窗可拖。
 * 数据来源：主窗口经 BroadcastChannel("flowsound-lyrics") 推送当前歌词行。
 *
 * 拖拽要点：-webkit-app-region: drag 必须挂在真实元素上（伪元素不生效）。
 * 锁定 = 整窗鼠标穿透（setIgnoreMouseEvents true + forward）——穿透时鼠标移动
 * 事件仍转发给页面，据此检测光标：进入工具条区域 → 临时恢复鼠标（可点🔓解锁），
 * 离开 → 重新穿透。解锁入口：工具条 🔓 / 托盘菜单 / 播放栏按钮关闭重开。
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

  // 锁定中：光标进入工具条热区（右上角 150x56）→ 临时恢复鼠标；离开 → 重新穿透
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!lockedRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const inZone = e.clientX > rect.right - 150 && e.clientY < rect.top + 56;
    if (inZone !== inZoneRef.current) {
      inZoneRef.current = inZone;
      applyIgnore(!inZone);
    }
  };

  return (
    <div className="desktop-lyrics-root" onMouseMove={handleMouseMove}>
      <div className="desktop-lyrics-pill">
        {/* 常驻工具条（右上角）：半透明小按钮，整窗锁定时通过热区仍可点 */}
        <div className="desktop-lyrics-tools">
          <button onClick={cycleFont} title="切换字号" className="desktop-lyrics-chip text-xs font-bold">
            Aa
          </button>
          <button
            onClick={handleLockToggle}
            title={locked ? "解锁桌面歌词" : "锁定（鼠标穿透防误点）"}
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

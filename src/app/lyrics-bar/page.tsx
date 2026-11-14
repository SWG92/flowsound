"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Heart, Palette, Lock, LockOpen, X, Music2 } from "lucide-react";
import { onLyricsBroadcast, sendLyricsCommand, isHeartbeatFresh, type LyricsMessage } from "@/lib/lyrics-broadcast";
import { getDesktop } from "@/lib/desktop";

/**
 * 桌面悬浮歌词（汽水音乐式）：
 * 紧凑横幅——控制行紧贴两行歌词，浅暗底色，悬浮于桌面。
 * Electron 壳内运行于置顶无边框窗口；数据复用 lyrics-broadcast 双通道。
 */

const LYRIC_COLORS = [
  { name: "绿", hex: "#4ade80", glow: "rgba(74,222,128,0.5)" },
  { name: "青", hex: "#22d3ee", glow: "rgba(34,211,238,0.5)" },
  { name: "粉", hex: "#f472b6", glow: "rgba(244,114,182,0.5)" },
  { name: "金", hex: "#fbbf24", glow: "rgba(251,191,36,0.5)" },
  { name: "紫", hex: "#a78bfa", glow: "rgba(167,139,250,0.5)" },
  { name: "白", hex: "#ffffff", glow: "rgba(255,255,255,0.4)" },
];

export default function LyricsBarPage() {
  const [state, setState] = useState<LyricsMessage>({ type: "sync" });
  const [colorIdx, setColorIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const [shell, setShell] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  // 监听主窗口广播 + localStorage 心跳兜底（与主窗口悬浮歌词面板同通道）
  useEffect(() => {
    const unsub = onLyricsBroadcast((data) => {
      if (data.type !== "sync") return;
      setState(data);
      if (data.lyricColorIdx !== undefined) setColorIdx(data.lyricColorIdx);
      if (data.locked !== undefined) setLocked(data.locked);
    });
    const interval = setInterval(() => {
      try {
        if (!isHeartbeatFresh()) return;
        const stored = localStorage.getItem("flowsound_lyrics_state");
        if (!stored) return;
        const data = JSON.parse(stored);
        if (data.type === "sync") {
          setState(data);
          if (data.lyricColorIdx !== undefined) setColorIdx(data.lyricColorIdx);
        }
      } catch { /* ignore */ }
    }, 1500);
    sendLyricsCommand({ type: "ping" });
    return () => { unsub(); clearInterval(interval); };
  }, []);

  // 桌面壳：底色同步窗口 backgroundColor；拖拽交给系统 app-region
  useEffect(() => {
    if (!getDesktop()) return;
    setShell(true);
    document.documentElement.style.background = "#20232e";
    document.body.style.background = "#20232e";
  }, []);

  // 桌面壳：锁定 = 原生鼠标穿透（解锁回主窗口悬浮歌词面板）
  useEffect(() => {
    getDesktop()?.setLyricsClickThrough(locked);
  }, [locked]);

  // 浏览器弹窗环境的拖拽（壳内走系统 app-region）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (locked || shell) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    setDragging(true);
    dragRef.current = { startX: e.screenX, startY: e.screenY, origX: window.screenX, origY: window.screenY };
    e.preventDefault();
  }, [locked, shell]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      window.moveTo(
        dragRef.current.origX + e.screenX - dragRef.current.startX,
        dragRef.current.origY + e.screenY - dragRef.current.startY
      );
    };
    const up = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [dragging]);

  const cycleColor = () => {
    const next = (colorIdx + 1) % LYRIC_COLORS.length;
    setColorIdx(next);
    sendLyricsCommand({ type: "setColor", value: next });
  };
  const togglePlay = () => sendLyricsCommand({ type: "togglePlay" });
  const toggleFav = () => sendLyricsCommand({ type: "toggleFavorite" });
  const toggleLock = () => {
    setLocked(!locked);
    sendLyricsCommand({ type: "setLocked", value: !locked });
  };

  const lyricColor = LYRIC_COLORS[colorIdx] ?? LYRIC_COLORS[0];
  const { songName, artist, lyrics = [], currentIndex = -1, isPlaying, isFavorite } = state;

  const cur = currentIndex >= 0 ? lyrics[currentIndex] : undefined;
  const next = currentIndex >= 0 ? lyrics[currentIndex + 1] : undefined;
  const line1 = cur?.text || (songName ? songName : "FlowSound 桌面歌词");
  const line2 = next?.text || (songName ? artist || "让音乐流动起来" : "在主窗口播放音乐即可同步歌词");

  return (
    <div
      onMouseDown={handleMouseDown}
      className={shell ? "app-drag" : undefined}
      style={{
        margin: 0, padding: 0, width: "100vw", height: "100vh",
        overflow: "hidden", background: "#20232e",
        display: "flex", flexDirection: "column",
        fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
        userSelect: "none", WebkitUserSelect: "none",
        cursor: locked ? "default" : dragging ? "grabbing" : "grab",
      }}
    >
      {/* ===== 控制行（紧贴歌词，汽水式） ===== */}
      <div
        style={{
          display: "flex", alignItems: "center",
          padding: "10px 18px 0",
          position: "relative", zIndex: 2,
        }}
      >
        {/* 左：歌曲标识 + 收藏 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <Music2 size={16} style={{ color: isPlaying ? lyricColor.hex : "rgba(255,255,255,0.5)", transition: "color 0.4s" }} />
          <button
            onClick={toggleFav}
            title={isFavorite ? "取消收藏" : "收藏"}
            className="app-no-drag"
            style={{
              border: "none", background: "transparent", cursor: "pointer", padding: 2,
              color: isFavorite ? lyricColor.hex : "rgba(255,255,255,0.55)", display: "flex",
              transition: "color 0.2s ease",
            }}
          >
            <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        {/* 中：上一首 / 播放 / 下一首 */}
        <div className="app-no-drag" style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <CtrlBtn onClick={() => sendLyricsCommand({ type: "prev" })} title="上一首">
            <SkipBack size={19} />
          </CtrlBtn>
          <CtrlBtn onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
            {isPlaying ? <Pause size={21} /> : <Play size={21} />}
          </CtrlBtn>
          <CtrlBtn onClick={() => sendLyricsCommand({ type: "next" })} title="下一首">
            <SkipForward size={19} />
          </CtrlBtn>
        </div>

        {/* 右：换色 / 锁定 / 关闭 */}
        <div className="app-no-drag" style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, justifyContent: "flex-end" }}>
          <CtrlBtn onClick={cycleColor} title={`歌词颜色：${lyricColor.name}`}>
            <Palette size={16} />
          </CtrlBtn>
          <CtrlBtn onClick={toggleLock} title={locked ? "解锁（回主窗口操作）" : "锁定并鼠标穿透"}>
            {locked ? <Lock size={16} /> : <LockOpen size={16} />}
          </CtrlBtn>
          <CtrlBtn onClick={() => window.close()} title="关闭">
            <X size={18} />
          </CtrlBtn>
        </div>
      </div>

      {/* ===== 两行歌词（居中，紧随控制行） ===== */}
      <div
        style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 4,
          padding: "2px 26px 10px", overflow: "hidden",
        }}
      >
        <p
          style={{
            margin: 0, maxWidth: "100%",
            fontSize: 38, fontWeight: 700, lineHeight: 1.25, textAlign: "center",
            color: cur ? lyricColor.hex : "rgba(255,255,255,0.9)",
            textShadow: "0 2px 6px rgba(0,0,0,0.55)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            transition: "color 0.4s ease",
          }}
        >
          {line1}
        </p>
        <p
          style={{
            margin: 0, maxWidth: "100%",
            fontSize: 27, fontWeight: 600, lineHeight: 1.25, textAlign: "center",
            color: "rgba(255,255,255,0.86)",
            textShadow: "0 2px 5px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {line2}
        </p>
      </div>
    </div>
  );
}

function CtrlBtn({
  onClick, title, children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        border: "none", background: "transparent", cursor: "pointer", padding: 4,
        color: "rgba(255,255,255,0.78)", display: "flex", borderRadius: 8,
        transition: "color 0.15s ease, background 0.15s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.78)"; e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Play, Pause, Heart, Palette, Lock, LockOpen, X } from "lucide-react";
import { onLyricsBroadcast, sendLyricsCommand, isHeartbeatFresh, type LyricsMessage } from "@/lib/lyrics-broadcast";
import { getDesktop } from "@/lib/desktop";

/**
 * 桌面悬浮歌词条（网易云/QQ音乐式）：
 * 细长条悬浮于桌面——当前行大字 + 下一行小字，hover 显露控制按钮。
 * Electron 壳内运行于透明置顶无边框窗口；数据复用 lyrics-broadcast 双通道。
 */

const LYRIC_COLORS = [
  { name: "绿", hex: "#1ed760", glow: "rgba(30,215,96,0.55)" },
  { name: "青", hex: "#22d3ee", glow: "rgba(34,211,238,0.55)" },
  { name: "粉", hex: "#f472b6", glow: "rgba(244,114,182,0.55)" },
  { name: "金", hex: "#fbbf24", glow: "rgba(251,191,36,0.55)" },
  { name: "紫", hex: "#a78bfa", glow: "rgba(167,139,250,0.55)" },
  { name: "白", hex: "#ffffff", glow: "rgba(255,255,255,0.45)" },
];

export default function LyricsBarPage() {
  const [state, setState] = useState<LyricsMessage>({ type: "sync" });
  const [colorIdx, setColorIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  // 监听主窗口广播 + localStorage 心跳兜底（与 lyrics-desktop 页同一套通道）
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

  // 桌面壳：原生透明窗口要求 html/body 全透明
  useEffect(() => {
    if (!getDesktop()) return;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  // 桌面壳：锁定 = 原生鼠标穿透（解锁回到主窗口悬浮歌词面板）
  useEffect(() => {
    getDesktop()?.setLyricsClickThrough(locked);
  }, [locked]);

  // 整条拖拽（网易云式按住即拖）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (locked) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    setDragging(true);
    dragRef.current = { startX: e.screenX, startY: e.screenY, origX: window.screenX, origY: window.screenY };
    e.preventDefault();
  }, [locked]);

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
  const line1 = cur?.text || (songName ? `♪ ${songName}${artist ? ` — ${artist}` : ""}` : "FlowSound 桌面歌词");
  const line2 = next?.text || (cur ? "" : "播放音乐即可同步歌词");

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDragging(false); }}
      style={{
        margin: 0, padding: 0, width: "100vw", height: "100vh",
        overflow: "hidden", background: "transparent",
        display: "flex", alignItems: "center",
        fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
        userSelect: "none", WebkitUserSelect: "none",
        cursor: locked ? "default" : dragging ? "grabbing" : "grab",
      }}
    >
      {/* 细长条主体 */}
      <div
        style={{
          width: "100%", height: 108,
          margin: "0 14px", padding: "0 20px",
          borderRadius: 22,
          background: "rgba(12,12,18,0.46)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          border: `1px solid ${isPlaying ? lyricColor.hex + "33" : "rgba(255,255,255,0.12)"}`,
          boxShadow: "0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 14,
          transition: "border-color 0.4s ease",
          position: "relative",
        }}
      >
        {/* 当前 + 下一行 */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }}>
          <p
            style={{
              margin: 0, fontSize: 25, fontWeight: 700, lineHeight: 1.25,
              color: lyricColor.hex,
              textShadow: `0 0 14px ${lyricColor.glow}, 0 1px 3px rgba(0,0,0,0.55)`,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              transition: "color 0.4s ease",
            }}
          >
            {line1}
          </p>
          <p
            style={{
              margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.3,
              color: "rgba(255,255,255,0.55)",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              minHeight: 19,
            }}
          >
            {line2}
          </p>
        </div>

        {/* 播放状态小圆点（未 hover 时唯一的"活"信号） */}
        <div
          style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: isPlaying ? lyricColor.hex : "rgba(255,255,255,0.25)",
            boxShadow: isPlaying ? `0 0 10px ${lyricColor.glow}` : "none",
            transition: "all 0.4s ease",
            opacity: hover ? 0 : 1,
          }}
        />

        {/* 控制按钮：hover 时浮现 */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 2, flexShrink: 0,
            opacity: hover ? 1 : 0,
            transform: hover ? "translateX(0)" : "translateX(6px)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
            pointerEvents: hover ? "auto" : "none",
          }}
        >
          <BarBtn onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </BarBtn>
          <BarBtn onClick={toggleFav} title={isFavorite ? "取消收藏" : "收藏"} active={isFavorite}>
            <Heart size={15} fill={isFavorite ? "currentColor" : "none"} />
          </BarBtn>
          <BarBtn onClick={cycleColor} title={`歌词颜色：${lyricColor.name}`}>
            <Palette size={15} />
          </BarBtn>
          <BarBtn onClick={toggleLock} title={locked ? "解锁（回主窗口操作）" : "锁定并鼠标穿透"}>
            {locked ? <Lock size={15} /> : <LockOpen size={15} />}
          </BarBtn>
          <BarBtn onClick={() => window.close()} title="关闭">
            <X size={15} />
          </BarBtn>
        </div>

        {/* 底部歌词色细线（播放态呼吸） */}
        <div
          style={{
            position: "absolute", left: 20, right: 20, bottom: 6, height: 2,
            borderRadius: 2, background: lyricColor.hex,
            opacity: isPlaying ? (hover ? 0.5 : 0.75) : 0.15,
            boxShadow: isPlaying ? `0 0 8px ${lyricColor.glow}` : "none",
            transition: "opacity 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function BarBtn({
  onClick, title, children, active,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "rgba(255,255,255,0.18)" : "transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.75)",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? "rgba(255,255,255,0.18)" : "transparent";
        e.currentTarget.style.color = active ? "#fff" : "rgba(255,255,255,0.75)";
      }}
    >
      {children}
    </button>
  );
}

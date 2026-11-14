"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Heart, Palette, Lock, LockOpen, X, Music2, Pin, PinOff } from "lucide-react";
import { onLyricsBroadcast, sendLyricsCommand, isHeartbeatFresh, type LyricsMessage } from "@/lib/lyrics-broadcast";
import { getDesktop } from "@/lib/desktop";

/**
 * 桌面悬浮歌词（QQ音乐/网易云式）：
 * 薄薄一条两行歌词悬浮桌面，平时只显示文字，鼠标悬停时右侧浮现控制按钮组。
 * Electron 壳内：透明置顶无边框窗口（FloatLyrics 配方：resizable:false
 * + 右下角把手 IPC 缩放）。数据复用 lyrics-broadcast 双通道。
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
  const [pinned, setPinned] = useState(true);    // 置顶默认开（图钉可关）
  const [shell, setShell] = useState(false);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  // 监听主窗口广播 + localStorage 心跳兜底
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

  // 桌面壳：原生透明窗口 html/body 须透明；拖拽交给系统 app-region
  useEffect(() => {
    if (!getDesktop()) return;
    setShell(true);
    document.documentElement.style.background = "#262b36";
    document.body.style.background = "#262b36";
  }, []);

  // 置顶开关同步主进程
  useEffect(() => {
    getDesktop()?.setLyricsPinned(pinned);
  }, [pinned]);

  // 桌面壳：锁定 = 原生鼠标穿透
  useEffect(() => {
    getDesktop()?.setLyricsClickThrough(locked);
  }, [locked]);

  // 浏览器弹窗环境的拖拽（壳内走系统 app-region）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (locked || shell) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    if (target.closest(".resize-grip")) return;
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

  // 右下角把手缩放（FloatLyrics 同款：屏幕坐标流 → 主进程 setBounds）
  const startResize = useCallback((e: React.MouseEvent) => {
    const d = getDesktop();
    if (!d || locked) return;
    e.preventDefault();
    e.stopPropagation();
    d.resizeOverlayStart(e.screenX, e.screenY);
    const move = (ev: MouseEvent) => d.resizeOverlayMove(ev.screenX, ev.screenY);
    const up = () => {
      d.resizeOverlayEnd();
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [locked]);

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
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        margin: 0, padding: 0, width: "100vw", height: "100vh",
        overflow: "hidden", background: "linear-gradient(160deg, #2a2f3c 0%, #232833 55%, #1d212b 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
        userSelect: "none", WebkitUserSelect: "none",
        cursor: locked ? "default" : dragging ? "grabbing" : "grab",
      }}
    >
      {/* 薄条主体（半透明玻璃，透出桌面） */}
      <div
        style={{
          width: "100%", height: "100%",
          background: "linear-gradient(160deg, #2e3340 0%, #262b36 55%, #222630 100%)",
          border: `1px solid ${isPlaying ? lyricColor.hex + "30" : "rgba(255,255,255,0.09)"}`,
          display: "flex", alignItems: "center",
          overflow: "hidden", position: "relative",
          transition: "border-color 0.4s ease",
        }}
      >
        {/* 拖拽区：只铺左侧歌词区，右侧控制胶囊物理隔离（纯几何，无挖洞） */}
        <div className="fs-drag-strip" style={{ left: 0, top: 0, bottom: 0, right: 330 }} />

        {/* 两行歌词（居中，平时唯一可见内容） */}
        <div
          style={{
            flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 3,
            padding: "0 24px", overflow: "hidden",
          }}
        >
          <p
            style={{
              margin: 0, maxWidth: "100%",
              fontSize: 32, fontWeight: 700, lineHeight: 1.25, textAlign: "center",
              color: cur ? lyricColor.hex : "rgba(255,255,255,0.9)",
              textShadow: "0 2px 6px rgba(0,0,0,0.6)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              transition: "color 0.4s ease",
            }}
          >
            {line1}
          </p>
          <p
            style={{
              margin: 0, maxWidth: "100%",
              fontSize: 22, fontWeight: 600, lineHeight: 1.25, textAlign: "center",
              color: "rgba(255,255,255,0.82)",
              textShadow: "0 2px 5px rgba(0,0,0,0.5)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {line2}
          </p>
        </div>

        {/* 播放状态小点（未悬停时的活性提示） */}
        <div
          style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginRight: 16,
            background: isPlaying ? lyricColor.hex : "rgba(255,255,255,0.25)",
            boxShadow: isPlaying ? `0 0 10px ${lyricColor.glow}` : "none",
            opacity: hover ? 0 : 1,
            transition: "opacity 0.2s ease, all 0.4s ease",
          }}
        />

        {/* 悬停浮现的控制按钮组（QQ音乐式，右侧半透明胶囊） */}
        <div
          className="app-no-drag"
          style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            display: "flex", alignItems: "center", gap: 2,
            padding: "5px 8px", borderRadius: 999,
            background: "rgba(10,11,16,0.55)",
            opacity: hover ? 1 : 0,
            pointerEvents: hover ? "auto" : "none",
            transition: "opacity 0.18s ease",
            zIndex: 3,
          }}
        >
          <BarBtn onClick={() => sendLyricsCommand({ type: "prev" })} title="上一首">
            <SkipBack size={15} />
          </BarBtn>
          <BarBtn onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </BarBtn>
          <BarBtn onClick={() => sendLyricsCommand({ type: "next" })} title="下一首">
            <SkipForward size={15} />
          </BarBtn>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
          <BarBtn onClick={toggleFav} title={isFavorite ? "取消收藏" : "收藏"} active={isFavorite}>
            <Heart size={15} fill={isFavorite ? "currentColor" : "none"} />
          </BarBtn>
          <BarBtn onClick={cycleColor} title={`歌词颜色：${lyricColor.name}`}>
            <Palette size={15} />
          </BarBtn>
          <BarBtn onClick={() => setPinned(!pinned)} title={pinned ? "取消置顶" : "置顶（悬浮于所有窗口）"}>
            {pinned ? <PinOff size={15} /> : <Pin size={15} />}
          </BarBtn>
          <BarBtn onClick={toggleLock} title={locked ? "解锁（回主窗口操作）" : "锁定并鼠标穿透"}>
            {locked ? <Lock size={15} /> : <LockOpen size={15} />}
          </BarBtn>
          <BarBtn onClick={() => window.close()} title="关闭">
            <X size={16} />
          </BarBtn>
        </div>
      </div>

      {/* 右下角缩放把手（FloatLyrics 式 grip） */}
      {shell && (
        <div
          onMouseDown={startResize}
          className="resize-grip app-no-drag"
          title="拖拽调整大小"
          style={{
            position: "absolute", right: 2, bottom: 2, width: 18, height: 18,
            cursor: "nwse-resize", zIndex: 10,
            display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
            color: "rgba(255,255,255,0.35)",
            opacity: hover ? 1 : 0.4,
            transition: "opacity 0.2s ease",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12">
            <path d="M11 1 L1 11 M11 6 L6 11 M11 11 L10.99 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      )}
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

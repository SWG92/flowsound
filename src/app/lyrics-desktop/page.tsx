"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { onLyricsBroadcast, sendLyricsCommand, type LyricsMessage } from "@/lib/lyrics-broadcast";

const LYRIC_COLORS = [
  { name: "绿", hex: "#1ed760", glow: "rgba(30,215,96,0.5)" },
  { name: "青", hex: "#22d3ee", glow: "rgba(34,211,238,0.5)" },
  { name: "粉", hex: "#f472b6", glow: "rgba(244,114,182,0.5)" },
  { name: "金", hex: "#fbbf24", glow: "rgba(251,191,36,0.5)" },
  { name: "紫", hex: "#a78bfa", glow: "rgba(167,139,250,0.5)" },
  { name: "白", hex: "#ffffff", glow: "rgba(255,255,255,0.4)" },
];

export default function DesktopLyricsPage() {
  const [state, setState] = useState<LyricsMessage>({ type: "sync" });
  const [colorIdx, setColorIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const lastIdxRef = useRef(-1);
  const [fadeState, setFadeState] = useState<Record<number, number>>({});

  // 监听主窗口广播
  useEffect(() => {
    const unsub = onLyricsBroadcast((data) => {
      if (data.type === "sync") {
        setState(data);
        if (data.lyricColorIdx !== undefined) setColorIdx(data.lyricColorIdx);
        if (data.locked !== undefined) setLocked(data.locked);
      }
    });

    // localStorage 轮询备用
    const interval = setInterval(() => {
      try {
        const stored = localStorage.getItem("flowsound_lyrics_state");
        if (stored) {
          const data = JSON.parse(stored);
          if (Date.now() - data._ts < 3000 && data.type === "sync") {
            setState(data);
            if (data.lyricColorIdx !== undefined) setColorIdx(data.lyricColorIdx);
          }
        }
      } catch { /* ignore */ }
    }, 1500);

    document.title = "FlowSound 桌面歌词";

    return () => { unsub(); clearInterval(interval); };
  }, []);

  // 歌词透明度渐变
  useEffect(() => {
    const idx = state.currentIndex ?? -1;
    if (idx === lastIdxRef.current) return;
    lastIdxRef.current = idx;

    const lyrics = state.lyrics ?? [];
    const newFade: Record<number, number> = {};
    for (let i = 0; i < lyrics.length; i++) {
      const dist = Math.abs(i - idx);
      if (dist === 0) newFade[i] = 1;
      else if (dist === 1) newFade[i] = 0.45;
      else if (dist === 2) newFade[i] = 0.18;
      else if (dist === 3) newFade[i] = 0.06;
      else newFade[i] = 0;
    }
    setFadeState(newFade);
  }, [state.currentIndex, state.lyrics]);

  // 自定义窗口拖拽（mousedown → mousemove → mouseup）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (locked) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: window.screenX, origY: window.screenY };
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

  const lyricColor = LYRIC_COLORS[colorIdx];
  const {
    songName, artist, lyrics = [], currentIndex = -1,
    isPlaying, isFavorite,
  } = state;

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        margin: 0, padding: 0,
        width: "100vw", height: "100vh",
        overflow: "hidden",
        background: "transparent",
        fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
        userSelect: "none", WebkitUserSelect: "none",
        cursor: dragging ? "grabbing" : locked ? "default" : "grab",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* 毛玻璃整体背景 */}
      <div style={{
        flex: 1, margin: 12,
        borderRadius: 28,
        background: "rgba(10,10,16,0.42)",
        backdropFilter: "blur(32px) saturate(180%)",
        WebkitBackdropFilter: "blur(32px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "border-color 0.5s ease",
        borderColor: isPlaying ? `${lyricColor.hex}22` : "rgba(255,255,255,0.1)",
      }}>
        {/* 流光渐变层 */}
        <div style={{
          position: "absolute", inset: 12, borderRadius: 28, pointerEvents: "none", zIndex: 0,
          background: `
            radial-gradient(ellipse 50% 20% at 50% 5%, ${lyricColor.glow}10 0%, transparent 60%),
            radial-gradient(ellipse 40% 15% at 50% 95%, ${lyricColor.glow}08 0%, transparent 60%)
          `,
        }} />

        {/* ===== 顶部工具栏 ===== */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          {/* 歌曲信息 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: isPlaying ? lyricColor.hex : "rgba(255,255,255,0.2)",
              boxShadow: isPlaying ? `0 0 10px ${lyricColor.glow}` : "none",
              transition: "all 0.5s ease",
            }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", lineHeight: 1.3 }}>
                {songName || "等待音乐..."}
              </p>
              {artist && (
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{artist}</p>
              )}
            </div>
          </div>

          {/* 按钮组 */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 12 }}>
            {/* 播放/暂停 */}
            <Btn onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </Btn>

            {/* 收藏 */}
            <Btn onClick={toggleFav} title={isFavorite ? "取消收藏" : "收藏"} active={isFavorite}>
              <HeartIcon filled={isFavorite} />
            </Btn>

            {/* 歌词颜色 */}
            <div style={{ position: "relative" }}>
              <Btn onClick={cycleColor} onContextMenu={(e) => { e.preventDefault(); setShowColors(!showColors); }} title={`颜色 · ${lyricColor.name}`}>
                <span style={{ fontSize: 14, color: lyricColor.hex }}>●</span>
              </Btn>
              {showColors && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 6, padding: 6,
                  borderRadius: 12, display: "flex", gap: 4, zIndex: 10,
                  background: "rgba(10,10,16,0.9)", backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  {LYRIC_COLORS.map((c, i) => (
                    <button
                      key={c.hex}
                      onClick={() => { setColorIdx(i); setShowColors(false); sendLyricsCommand({ type: "setColor", value: i }); }}
                      style={{
                        width: 26, height: 26, borderRadius: 8, border: "none", cursor: "pointer",
                        background: c.hex,
                        outline: i === colorIdx ? "2px solid rgba(255,255,255,0.5)" : "none",
                        outlineOffset: 2,
                        boxShadow: i === colorIdx ? `0 0 10px ${c.glow}` : "none",
                        transform: i === colorIdx ? "scale(1.15)" : "scale(1)",
                        transition: "all 0.2s",
                      }}
                      title={c.name}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 锁定 */}
            <Btn onClick={toggleLock} title={locked ? "已锁定" : "锁定位置"} active={locked}>
              {locked ? <LockIcon /> : <UnlockIcon />}
            </Btn>

            {/* 关闭 */}
            <Btn onClick={() => window.close()} title="关闭">
              <CloseIcon />
            </Btn>
          </div>
        </div>

        {/* ===== 歌词内容 ===== */}
        <div style={{
          position: "relative", zIndex: 1, flex: 1,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "24px 24px 32px", gap: 0,
        }}>
          {!songName ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 56, margin: "0 0 16px", opacity: 0.3 }}>🎵</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 15, margin: 0 }}>等待音乐播放...</p>
              <p style={{ color: "rgba(255,255,255,0.12)", fontSize: 12, margin: "6px 0 0" }}>
                在主窗口播放音乐即可同步
              </p>
            </div>
          ) : lyrics.length === 0 ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 48, margin: "0 0 12px" }}>🎵</p>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 22, fontWeight: 700, margin: 0 }}>
                {songName}
              </p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: "4px 0" }}>{artist}</p>
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, margin: "8px 0 0" }}>暂无歌词</p>
            </div>
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 22,
              width: "100%",
            }}>
              {lyrics.map((line, i) => {
                const dist = Math.abs(i - currentIndex);
                const opacity = fadeState[i] ?? 0;
                if (dist > 3) return null;
                const isCurrent = dist === 0;

                return (
                  <div key={i} style={{
                    textAlign: "center", lineHeight: 1.7, opacity,
                    transition: "opacity 0.6s cubic-bezier(0.25,0.1,0.25,1), transform 0.6s cubic-bezier(0.25,0.1,0.25,1)",
                    transform: isCurrent ? "scale(1.04)" : "scale(1)",
                  }}>
                    <p style={{
                      margin: 0,
                      fontSize: isCurrent ? 28 : dist === 1 ? 18 : 14,
                      fontWeight: isCurrent ? 700 : dist === 1 ? 500 : 400,
                      color: isCurrent
                        ? lyricColor.hex
                        : `rgba(255,255,255,${(0.7 - dist * 0.2).toFixed(2)})`,
                      textShadow: isCurrent
                        ? `0 0 36px ${lyricColor.glow}, 0 0 72px ${lyricColor.glow}66, 0 2px 6px rgba(0,0,0,0.5)`
                        : "none",
                      letterSpacing: isCurrent ? "0.03em" : "0",
                      padding: "0 8px",
                      transition: "all 0.5s cubic-bezier(0.25,0.1,0.25,1)",
                      wordBreak: "break-word",
                      filter: isCurrent && isPlaying ? "brightness(1.15)" : isCurrent ? "brightness(0.8)" : "none",
                    }}>
                      {line.text}
                    </p>
                    {line.transText && opacity > 0.05 && (
                      <p style={{
                        margin: "4px 0 0",
                        fontSize: isCurrent ? 15 : 12,
                        color: isCurrent ? `${lyricColor.hex}99` : `rgba(255,255,255,${(0.25 - dist * 0.08).toFixed(2)})`,
                        transition: "all 0.5s cubic-bezier(0.25,0.1,0.25,1)",
                        fontWeight: isCurrent ? 500 : 400,
                        wordBreak: "break-word",
                        padding: "0 8px",
                      }}>
                        {line.transText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== 底部状态栏 ===== */}
        <div style={{
          position: "relative", zIndex: 1,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px 16px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>
            {isPlaying ? "● 播放中" : "◎ 已暂停"}
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.12)", fontVariantNumeric: "tabular-nums" }}>
            {currentIndex >= 0 ? `${currentIndex + 1} / ${lyrics.length}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ===== 内联图标组件 (避免额外依赖) =====

function Btn({ onClick, onContextMenu, title, active, children }: {
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onContextMenu={onContextMenu ? (e) => { e.stopPropagation(); onContextMenu(e); } : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: "none", background: active ? "rgba(255,255,255,0.08)" : hover ? "rgba(255,255,255,0.06)" : "transparent",
        borderRadius: 8, padding: "6px 7px", cursor: "pointer",
        color: active ? "rgba(255,255,255,0.9)" : hover ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)",
        transition: "all 0.15s",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      title={title}
    >
      {children}
    </button>
  );
}

// SVG 图标组件
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19" /></svg>
);
const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
);
const HeartIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);
const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
);
const UnlockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 019.9-1" /></svg>
);
const CloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

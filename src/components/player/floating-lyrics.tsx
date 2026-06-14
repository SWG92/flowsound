"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePlayerStore } from "@/lib/store";
import { Heart, Lock, Unlock, X } from "lucide-react";

const LYRIC_COLORS = [
  { name: "绿", hex: "#1ed760", glow: "rgba(30,215,96,0.5)" },
  { name: "青", hex: "#22d3ee", glow: "rgba(34,211,238,0.5)" },
  { name: "粉", hex: "#f472b6", glow: "rgba(244,114,182,0.5)" },
  { name: "金", hex: "#fbbf24", glow: "rgba(251,191,36,0.5)" },
  { name: "紫", hex: "#a78bfa", glow: "rgba(167,139,250,0.5)" },
  { name: "白", hex: "#ffffff", glow: "rgba(255,255,255,0.4)" },
];

function loadColor(): number {
  if (typeof window === "undefined") return 0;
  try { return parseInt(localStorage.getItem("flowsound_lyric_color") || "0"); } catch { return 0; }
}

export function FloatingLyrics() {
  const {
    lyrics, currentLyricIndex, currentSong, isPlaying,
    togglePlay, showFloatingLyrics, setShowFloatingLyrics,
    toggleFavorite, isFavorite,
  } = usePlayerStore();

  const [locked, setLocked] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [colorIdx, setColorIdx] = useState(loadColor);
  const [showColors, setShowColors] = useState(false);
  const [fadeState, setFadeState] = useState<Record<number, number>>({});
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const initialized = useRef(false);
  const lastIdxRef = useRef(-1);

  const lyricColor = LYRIC_COLORS[colorIdx];

  // 初始化位置
  useEffect(() => {
    if (!initialized.current && typeof window !== "undefined") {
      initialized.current = true;
      try {
        const saved = localStorage.getItem("flowsound_lyrics_pos");
        if (saved) setPos(JSON.parse(saved));
        else setPos({ x: (window.innerWidth - 560) / 2 + 60, y: (window.innerHeight - 600) / 2 });
      } catch {
        setPos({ x: (window.innerWidth - 560) / 2 + 60, y: (window.innerHeight - 600) / 2 });
      }
    }
  }, []);

  useEffect(() => {
    if (initialized.current) localStorage.setItem("flowsound_lyrics_pos", JSON.stringify(pos));
  }, [pos]);

  // 歌词透明度渐变（平滑过渡，和主页面歌词逻辑一致）
  useEffect(() => {
    const idx = currentLyricIndex;
    if (idx === lastIdxRef.current) return;
    lastIdxRef.current = idx;

    const newFade: Record<number, number> = {};
    for (let i = 0; i < lyrics.length; i++) {
      const dist = Math.abs(i - idx);
      if (dist === 0) newFade[i] = 1;
      else if (dist === 1) newFade[i] = 0.6;
      else if (dist === 2) newFade[i] = 0.3;
      else if (dist === 3) newFade[i] = 0.12;
      else if (dist === 4) newFade[i] = 0.04;
      else newFade[i] = 0;
    }
    setFadeState(newFade);
  }, [currentLyricIndex, lyrics]);

  // 全容器可拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (locked) return;
    if ((e.target as HTMLElement).closest("button")) return;
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    e.preventDefault();
  }, [pos, locked]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 560, dragRef.current.origX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 520, dragRef.current.origY + e.clientY - dragRef.current.startY)),
      });
    };
    const up = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [dragging]);

  useEffect(() => {
    if (!showFloatingLyrics) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !locked) setShowFloatingLyrics(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [showFloatingLyrics, locked, setShowFloatingLyrics]);

  const isFav = currentSong ? isFavorite(currentSong.id) : false;

  if (!currentSong || !showFloatingLyrics) return null;

  return (
    <div
      className="fixed z-[99999] select-none"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={handleMouseDown}
    >
      <div
        className="relative w-[560px] rounded-[28px] overflow-hidden"
        style={{
          background: "rgba(10,10,16,0.38)",
          backdropFilter: "blur(36px) saturate(180%)",
          WebkitBackdropFilter: "blur(36px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
          cursor: dragging ? "grabbing" : locked ? "default" : "grab",
        }}
      >
        {/* 流光背景 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 50% 20% at 50% 5%, ${lyricColor.glow}0D 0%, transparent 60%),
              radial-gradient(ellipse 40% 15% at 50% 95%, ${lyricColor.glow}08 0%, transparent 60%)
            `,
          }}
        />

        {/* ===== 顶部工具栏 ===== */}
        <div className="relative flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-500"
              style={{ background: isPlaying ? lyricColor.hex : "rgba(255,255,255,0.2)", boxShadow: isPlaying ? `0 0 10px ${lyricColor.glow}` : "none" }}
            />
            <div className="min-w-0">
              <p className="text-sm text-white/80 font-semibold truncate">{currentSong.name}</p>
              <p className="text-[11px] text-white/30 truncate">{currentSong.artists?.map(a => a.name).join(" / ")}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-4">
            <TBtn onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
              {isPlaying ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>
              )}
            </TBtn>

            <TBtn onClick={() => currentSong && toggleFavorite(currentSong)} title={isFav ? "取消收藏" : "收藏"} active={isFav}>
              <Heart className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
            </TBtn>

            <div className="relative">
              <TBtn onClick={() => setShowColors(!showColors)} title={`歌词颜色 · ${lyricColor.name}`}>
                <span style={{ fontSize: 16, color: lyricColor.hex, lineHeight: 1 }}>●</span>
              </TBtn>
              {showColors && (
                <div className="absolute top-full right-0 mt-1.5 p-1.5 rounded-xl z-10 flex gap-1" style={{ background: "rgba(10,10,16,0.9)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {LYRIC_COLORS.map((c, i) => (
                    <button
                      key={c.hex}
                      onClick={() => { setColorIdx(i); setShowColors(false); localStorage.setItem("flowsound_lyric_color", String(i)); }}
                      className="w-7 h-7 rounded-lg cursor-pointer transition-transform hover:scale-110"
                      style={{ background: c.hex, outline: i === colorIdx ? "2px solid rgba(255,255,255,0.5)" : "none", outlineOffset: 2, boxShadow: i === colorIdx ? `0 0 10px ${c.glow}` : "none", transform: i === colorIdx ? "scale(1.15)" : "scale(1)" }}
                      title={c.name}
                    />
                  ))}
                </div>
              )}
            </div>

            <TBtn onClick={() => setLocked(!locked)} title={locked ? "已锁定" : "锁定位置"} active={locked}>
              {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </TBtn>

            <TBtn onClick={() => setShowFloatingLyrics(false)} title="关闭">
              <X className="h-4 w-4" />
            </TBtn>
          </div>
        </div>

        {/* ===== 歌词区 - 多行渐变 ===== */}
        <div className="relative flex flex-col items-center justify-center px-6 py-6 gap-0 min-h-[380px]">
          {lyrics.length === 0 ? (
            <div className="text-center">
              <p className="text-5xl mb-4 opacity-30">🎵</p>
              <p className="text-lg font-bold text-white/70">{currentSong.name}</p>
              <p className="text-sm text-white/30 mt-1">暂无歌词</p>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full" style={{ gap: 16 }}>
              {lyrics.map((line, i) => {
                const dist = Math.abs(i - currentLyricIndex);
                const opacity = fadeState[i] ?? 0;
                if (dist > 4) return null;
                const isCurrent = dist === 0;

                return (
                  <div
                    key={i}
                    style={{
                      textAlign: "center",
                      lineHeight: 1.7,
                      opacity,
                      transform: isCurrent ? "scale(1.04)" : "scale(1)",
                      transition: "opacity 0.6s cubic-bezier(0.25,0.1,0.25,1), transform 0.6s cubic-bezier(0.25,0.1,0.25,1)",
                      pointerEvents: "none",
                    }}
                  >
                    <p style={{
                      margin: 0,
                      fontSize: isCurrent ? 28 : dist === 1 ? 18 : dist === 2 ? 15 : 13,
                      fontWeight: isCurrent ? 700 : dist === 1 ? 500 : 400,
                      color: isCurrent
                        ? lyricColor.hex
                        : `rgba(255,255,255,${(0.7 - dist * 0.18).toFixed(2)})`,
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
                    {line.transText && opacity > 0.04 && (
                      <p style={{
                        margin: "4px 0 0",
                        fontSize: isCurrent ? 15 : 11,
                        color: isCurrent ? `${lyricColor.hex}99` : `rgba(255,255,255,${(0.25 - dist * 0.06).toFixed(2)})`,
                        transition: "all 0.5s cubic-bezier(0.25,0.1,0.25,1)",
                        fontWeight: isCurrent ? 500 : 400,
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
        <div className="relative flex items-center justify-between px-5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.06)" }}>
          <span className="text-[11px] text-white/18">{isPlaying ? "● 播放中" : "◎ 已暂停"}</span>
          <span className="text-[11px] text-white/12 tabular-nums">
            {currentLyricIndex >= 0 ? `${currentLyricIndex + 1} / ${lyrics.length}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function TBtn({ onClick, title, active, children }: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center"
      style={{
        background: active ? "rgba(255,255,255,0.08)" : hover ? "rgba(255,255,255,0.06)" : "transparent",
        color: active ? "rgba(255,255,255,0.9)" : hover ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)",
      }}
      title={title}
    >
      {children}
    </button>
  );
}

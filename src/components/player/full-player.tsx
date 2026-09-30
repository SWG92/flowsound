"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, ListMusic, Loader2, Pause, Play, SkipBack, SkipForward, Repeat, Shuffle } from "lucide-react";
import { usePlayerStore } from "@/lib/store";
import { audioPlayer } from "@/lib/audio-player";
import { cn, getCoverUrl } from "@/lib/utils";

/**
 * 全屏播放页（iOS 风格）：点播放栏封面/歌名展开。
 * 背景 = 当前封面高斯模糊放大；中部大封面与歌词；底部完整控制区。
 * 点击收起按钮或按 Esc 返回。
 */
export function FullPlayer() {
  const fullOpen = usePlayerStore((s) => s.showFullPlayer);
  const setFullOpen = usePlayerStore((s) => s.setShowFullPlayer);
  const {
    currentSong, isPlaying, isLoading, currentTime, duration,
    setShowQueue,
    lyrics, currentLyricIndex, playMode,
    togglePlay, nextSong, prevSong, setPlayMode,
    toggleFavorite, isFavorite,
  } = usePlayerStore();

  const [showLyricsView, setShowLyricsView] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  // Esc 收起
  useEffect(() => {
    if (!fullOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullOpen, setFullOpen]);

  // 歌词自动滚动
  const scrollToLyric = (index: number) => {
    const el = containerRef.current?.querySelector(`[data-lyric-index="${index}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  useEffect(() => {
    if (!fullOpen || !showLyricsView) return;
    if (!hasScrolled.current && currentLyricIndex >= 0) {
      scrollToLyric(currentLyricIndex);
      hasScrolled.current = true;
      return;
    }
    scrollToLyric(currentLyricIndex);
  }, [currentLyricIndex, fullOpen, showLyricsView]);
  useEffect(() => {
    hasScrolled.current = false;
  }, [fullOpen, currentSong?.id]);

  if (!fullOpen || !currentSong) return null;

  const cover = getCoverUrl(currentSong);
  const fmt = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };
  const fav = isFavorite(currentSong.id);

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden flex flex-col animate-in fade-in-0 duration-300">
      {/* 背景：封面高斯模糊放大 + 深色遮罩 */}
      {cover && (
        <img
          src={cover + "?param=600y600"}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl"
        />
      )}
      <div className="absolute inset-0 bg-black/55" />

      {/* 顶部：收起 + 标题 */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6">
        <button
          onClick={() => setFullOpen(false)}
          className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
          title="收起"
        >
          <ChevronDown className="h-7 w-7" />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">正在播放</p>
          <p className="text-sm text-white/90">{currentSong.album?.name || ""}</p>
        </div>
        <button
          onClick={() => toggleFavorite(currentSong)}
          className={cn("p-2 rounded-full cursor-pointer transition-colors", fav ? "text-red-400" : "text-white/80 hover:text-white hover:bg-white/10")}
          title={fav ? "取消收藏" : "收藏"}
        >
          <Heart className={cn("h-6 w-6", fav && "fill-red-400")} />
        </button>
      </div>

      {/* 中部：封面 / 歌词 */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 min-h-0">
        {showLyricsView ? (
          <div ref={containerRef} className="w-full max-w-xl flex-1 overflow-y-auto py-12 scrollbar-hide [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]">
            {lyrics.length === 0 ? (
              <p className="text-center text-white/50 mt-16">暂无歌词</p>
            ) : (
              lyrics.map((line, i) => (
                <div
                  key={i}
                  data-lyric-index={i}
                  onClick={() => audioPlayer.seek(line.time)}
                  className={cn(
                    "text-center cursor-pointer select-none py-2 transition-all duration-300",
                    i === currentLyricIndex
                      ? "text-2xl font-semibold text-white"
                      : "text-base text-white/45 hover:text-white/70"
                  )}
                >
                  {line.text}
                  {line.transText && (
                    <p className={cn("text-sm mt-0.5", i === currentLyricIndex ? "text-white/85" : "text-white/25")}>
                      {line.transText}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            <div
              className={cn(
                "w-64 h-64 md:w-80 md:h-80 rounded-[28px] overflow-hidden shadow-2xl",
                isPlaying && "shadow-primary/30"
              )}
            >
              {cover ? (
                <img src={cover + "?param=500y500"} alt={currentSong.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-6xl">🎵</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 歌名 + 歌手 */}
      <div className="relative z-10 px-8 pb-2 text-center">
        <h2 className="text-2xl font-bold text-white truncate">{currentSong.name}</h2>
        <p className="text-white/60 text-sm mt-1">
          {currentSong.artists?.map((a) => a.name).join(" / ")}
        </p>
      </div>

      {/* 底部控制区 */}
      <div className="relative z-10 px-8 pb-10 pt-2 max-w-xl mx-auto w-full">
        {/* 视图切换：封面 / 歌词 */}
        <div className="flex justify-center mb-3 gap-2">
          <button
            onClick={() => setShowLyricsView(false)}
            className={cn("px-3 py-1 rounded-full text-xs cursor-pointer transition-colors", !showLyricsView ? "bg-white/25 text-white" : "text-white/50 hover:text-white/80")}
          >
            封面
          </button>
          <button
            onClick={() => setShowLyricsView(true)}
            className={cn("px-3 py-1 rounded-full text-xs cursor-pointer transition-colors", showLyricsView ? "bg-white/25 text-white" : "text-white/50 hover:text-white/80")}
          >
            歌词
          </button>
        </div>

        {/* 进度条 */}
        <div className="flex items-center gap-3 text-xs text-white/60 tabular-nums">
          <span>{fmt(currentTime)}</span>
          <div className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white/85 rounded-full"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
            />
          </div>
          <span>{fmt(duration)}</span>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-8 mt-5">
          <button
            onClick={() => setPlayMode(playMode === "list" ? "single" : playMode === "single" ? "shuffle" : "list")}
            className="text-white/70 hover:text-white cursor-pointer transition-colors"
            title={playMode === "list" ? "列表循环" : playMode === "single" ? "单曲循环" : "随机播放"}
          >
            {playMode === "shuffle" ? <Shuffle className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
          </button>
          <button onClick={prevSong} className="text-white cursor-pointer transition-transform active:scale-90" title="上一首">
            <SkipBack className="h-8 w-8" fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center cursor-pointer shadow-lg transition-transform active:scale-90"
            title={isPlaying ? "暂停" : "播放"}
          >
            {isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-7 w-7" fill="currentColor" />
            ) : (
              <Play className="h-7 w-7 ml-1" fill="currentColor" />
            )}
          </button>
          <button onClick={nextSong} className="text-white cursor-pointer transition-transform active:scale-90" title="下一首">
            <SkipForward className="h-8 w-8" fill="currentColor" />
          </button>
          <button
            onClick={() => { setShowQueue(true); setFullOpen(false); }}
            className="text-white/70 hover:text-white cursor-pointer transition-colors"
            title="播放队列"
          >
            <ListMusic className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

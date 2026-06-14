"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { usePlayerStore } from "@/lib/store";
import { audioPlayer } from "@/lib/audio-player";
import { cn, getCoverUrl } from "@/lib/utils";

export function LyricsDisplay() {
  const { lyrics, currentLyricIndex, currentSong, isPlaying } = usePlayerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolledOnMount = useRef(false);
  // 用户手动滚动时暂停自动滚动，停止后 2 秒恢复
  const [userScrolling, setUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserScrollRef = useRef(false);

  // 滚动到指定歌词行
  const scrollToLyric = useCallback((index: number, smooth = true) => {
    if (!containerRef.current || index < 0) return;
    const activeEl = containerRef.current.querySelector(`[data-lyric-index="${index}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: smooth ? "smooth" : "instant",
        block: "center",
      });
    }
  }, []);

  // 组件挂载时立即定位到当前歌词（无动画）
  useEffect(() => {
    if (!hasScrolledOnMount.current && currentLyricIndex >= 0) {
      scrollToLyric(currentLyricIndex, false);
      hasScrolledOnMount.current = true;
    }
  }, [currentLyricIndex, scrollToLyric]);

  // 歌词变化时自动滚动（仅在非手动滚动状态下）
  useEffect(() => {
    if (hasScrolledOnMount.current && !isUserScrollRef.current) {
      scrollToLyric(currentLyricIndex, true);
    }
  }, [currentLyricIndex, scrollToLyric]);

  // 监听用户手动滚动
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!isUserScrollRef.current) {
        isUserScrollRef.current = true;
        setUserScrolling(true);
      }
      // 重置计时器：停止滚动 2 秒后恢复自动滚动
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollRef.current = false;
        setUserScrolling(false);
      }, 2000);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // 点击歌词跳转到对应时间
  const handleLyricClick = useCallback((time: number) => {
    audioPlayer.seek(time);
    // 点击跳转后立即恢复自动滚动
    isUserScrollRef.current = false;
    setUserScrolling(false);
  }, []);

  if (!currentSong) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        选择一首歌曲开始播放
      </div>
    );
  }

  if (lyrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-48 h-48 rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
          {getCoverUrl(currentSong) ? (
            <img
              src={getCoverUrl(currentSong) + "?param=400y400"}
              alt={currentSong.name}
              className={cn("w-full h-full object-cover", isPlaying && "animate-spin [animation-duration:20s]")}
            />
          ) : (
            <span className="text-6xl">🎵</span>
          )}
        </div>
        <p className="text-muted-foreground text-sm">暂无歌词</p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-6 py-8 space-y-4 scrollbar-hide"
      >
        {/* 顶部留白 */}
        <div className="h-40" />

        {lyrics.map((line, index) => (
          <div
            key={index}
            data-lyric-index={index}
            onClick={() => handleLyricClick(line.time)}
            className="cursor-pointer select-none text-center"
          >
            <p
              className={cn(
                "transition-all duration-300",
                index === currentLyricIndex
                  ? "lyric-active text-base"
                  : "lyric-inactive text-sm hover:text-foreground/60"
              )}
            >
              {line.text}
            </p>
            {line.transText && (
              <p
                className={cn(
                  "transition-all duration-300 mt-0.5",
                  index === currentLyricIndex
                    ? "text-primary/70 text-sm"
                    : "text-muted-foreground/40 text-xs"
                )}
              >
                {line.transText}
              </p>
            )}
          </div>
        ))}

        {/* 底部留白 */}
        <div className="h-40" />
      </div>
    </div>
  );
}

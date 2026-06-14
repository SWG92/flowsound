"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/lib/store";
import { cn, getCoverUrl } from "@/lib/utils";

export function MiniPlayer() {
  const { currentSong, isPlaying, togglePlay, nextSong } = usePlayerStore();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const prevSongIdRef = useRef<number | null>(null);

  // 只在新歌曲开始播放时自动显示（且未被手动关闭）
  useEffect(() => {
    if (currentSong && isPlaying && currentSong.id !== prevSongIdRef.current) {
      prevSongIdRef.current = currentSong.id;
      if (!dismissed) {
        setVisible(true);
      }
    }
  }, [currentSong, isPlaying, dismissed]);

  // 用户关闭迷你播放器
  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
  }, []);

  // 拖拽逻辑
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - offsetRef.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 80, e.clientY - offsetRef.current.y)),
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  if (!visible || !currentSong) return null;

  const coverUrl = getCoverUrl(currentSong);

  return (
    <div
      ref={dragRef}
      className="fixed z-[60] glass rounded-2xl shadow-lg cursor-move select-none"
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center gap-3 p-2 pr-3">
        {/* 封面 */}
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
          {coverUrl ? (
            <img src={coverUrl + "?param=100y100"} alt="" className={cn("w-full h-full object-cover", isPlaying && "animate-spin [animation-duration:8s]")} />
          ) : (
            <div className="w-full h-full bg-muted" />
          )}
        </div>

        {/* 歌名 */}
        <div className="min-w-0 flex-1" style={{ pointerEvents: "none" }}>
          <p className="text-sm font-medium truncate">{currentSong.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {currentSong.artists?.map((a) => a.name).join(" / ")}
          </p>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center gap-1" style={{ pointerEvents: "auto" }}>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={nextSong}>
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

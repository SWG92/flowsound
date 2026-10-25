"use client";

import { useVisualizer } from "@/hooks/use-visualizer";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { usePlayerStore } from "@/lib/store";
import { getCoverUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface VisualizerBarsProps {
  barCount?: number;
  className?: string;
  maxHeight?: number;
}

/**
 * 音乐播放可视化条。
 * 由于网易云 CDN 音频为跨域资源（无 CORS 头），Web Audio API 不可用，
 * 使用 CSS 关键帧动画。播放时跳动，暂停时静止。
 * 颜色跟随当前歌曲专辑主色（取色结果与全屏页共享缓存）。
 */
export function VisualizerBars({
  barCount = 8,
  className,
  maxHeight = 40,
}: VisualizerBarsProps) {
  const { isActive } = useVisualizer();
  const currentSong = usePlayerStore((s) => s.currentSong);
  const accent = useDominantColor(currentSong ? getCoverUrl(currentSong) : null);

  return (
    <div
      className={cn("flex items-end justify-center gap-[2px]", className)}
      style={{ height: maxHeight, "--eq-bar-color": accent ?? undefined } as React.CSSProperties}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          className="eq-bar"
          style={{
            animationPlayState: isActive ? "running" : "paused",
            height: isActive ? undefined : "3px",
          }}
        />
      ))}
    </div>
  );
}

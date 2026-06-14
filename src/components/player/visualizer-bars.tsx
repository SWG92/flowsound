"use client";

import { useVisualizer } from "@/hooks/use-visualizer";
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
 */
export function VisualizerBars({
  barCount = 8,
  className,
  maxHeight = 40,
}: VisualizerBarsProps) {
  const { isActive } = useVisualizer(64);

  return (
    <div
      className={cn("flex items-end justify-center gap-[2px]", className)}
      style={{ height: maxHeight }}
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

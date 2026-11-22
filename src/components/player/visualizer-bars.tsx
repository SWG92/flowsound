"use client";

import { useEffect, useRef, useState } from "react";
import { useVisualizer } from "@/hooks/use-visualizer";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { usePlayerStore } from "@/lib/store";
import { getAnalyser } from "@/lib/equalizer";
import { getCoverUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface VisualizerBarsProps {
  barCount?: number;
  className?: string;
  maxHeight?: number;
}

/**
 * 音乐播放可视化条。
 * 双模式：
 * - 真实频谱：音频增强开启时（同源流 + Web Audio 图），rAF 读取 AnalyserNode
 *   频率数据驱动条高——跟随音乐真实律动；
 * - CSS 兜底：无分析器（直连 CDN/网页端关闭增强）时保持关键帧动画。
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
  const barsRef = useRef<HTMLDivElement>(null);
  const [realMode, setRealMode] = useState(false);

  // 轮询分析器可用性（同源流播放 + Web Audio 图建立后出现）
  useEffect(() => {
    const t = setInterval(() => setRealMode(!!getAnalyser()), 800);
    return () => clearInterval(t);
  }, []);

  // 真实频谱模式：rAF 读取频率数据驱动条高（低频段权重靠前的对数取样）
  useEffect(() => {
    if (!realMode) return;
    let raf = 0;
    const buf = new Uint8Array(64);
    const tick = () => {
      const analyser = getAnalyser();
      const el = barsRef.current;
      if (analyser && el) {
        analyser.getByteFrequencyData(buf);
        const spans = el.children;
        for (let i = 0; i < spans.length; i++) {
          const start = Math.floor((i / spans.length) ** 1.4 * buf.length);
          const end = Math.max(start + 1, Math.floor(((i + 1) / spans.length) ** 1.4 * buf.length));
          let sum = 0;
          for (let j = start; j < end; j++) sum += buf[j];
          const v = sum / (end - start) / 255;
          const span = spans[i] as HTMLElement;
          span.style.animation = "none";
          span.style.height = `${Math.max(10, Math.round(v * 100))}%`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [realMode]);

  return (
    <div
      ref={barsRef}
      className={cn("flex items-end justify-center gap-[2px]", className)}
      style={{ height: maxHeight, "--eq-bar-color": accent ?? undefined } as React.CSSProperties}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          className="eq-bar"
          style={
            realMode
              ? { animation: "none", height: "12%" } // rAF 接管高度
              : {
                  animationPlayState: isActive ? "running" : "paused",
                  height: isActive ? undefined : "3px",
                }
          }
        />
      ))}
    </div>
  );
}

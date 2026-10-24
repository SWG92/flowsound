"use client";

import { useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { usePlayerStore } from "@/lib/store";
import { audioPlayer } from "@/lib/audio-player";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 播放栏进度条：自订阅 currentTime/duration。
 * 独立成组件让 250ms 一次的进度更新只重渲染本组件，而非整个播放栏（含各弹窗菜单）。 */
export function ProgressBar() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  // 拖拽进度条时使用本地状态，隔离 rAF 循环的 currentTime 更新，防止抽搐
  const [dragTime, setDragTime] = useState<number | null>(null);
  const dragTimeRef = useRef<number | null>(null);

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
      <Slider
        value={[dragTime ?? currentTime]}
        max={duration || 100}
        step={0.1}
        onValueChange={(val) => {
          const t = Array.isArray(val) ? val[0] : val;
          audioPlayer.setSeeking(true);
          dragTimeRef.current = t;
          setDragTime(t);
        }}
        onValueCommitted={() => {
          if (dragTimeRef.current !== null) {
            audioPlayer.seek(dragTimeRef.current);
            dragTimeRef.current = null;
          }
          audioPlayer.setSeeking(false);
          setDragTime(null);
        }}
        className="flex-1"
      />
      <span className="text-xs text-muted-foreground w-10 tabular-nums">{formatTime(duration)}</span>
    </div>
  );
}

/** 全屏播放页的只读进度条：自订阅进度，更新只重渲染本组件而非整个全屏页。 */
export function ProgressFill({ className }: { className?: string }) {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  return (
    <div className={cn("flex items-center gap-3 text-xs text-white/60 tabular-nums", className)}>
      <span>{formatTime(currentTime)}</span>
      <div className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full bg-white/85 rounded-full"
          style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
        />
      </div>
      <span>{formatTime(duration)}</span>
    </div>
  );
}

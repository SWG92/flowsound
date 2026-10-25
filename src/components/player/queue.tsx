"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Lock, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlayerStore } from "@/lib/store";
import { cn, getCoverUrl } from "@/lib/utils";
import { useDominantColor } from "@/hooks/use-dominant-color";

/** hex → rgba（带透明度） */
function hexA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function PlayQueue() {
  // 字段级订阅：currentTime 等高频切片变化不再引发整个队列列表重渲染
  const queue = usePlayerStore((s) => s.queue);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const playSong = usePlayerStore((s) => s.playSong);
  const showQueue = usePlayerStore((s) => s.showQueue);
  const setShowQueue = usePlayerStore((s) => s.setShowQueue);
  const reorderQueue = usePlayerStore((s) => s.reorderQueue);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  // 浮在全屏播放页上层时：切换为深色玻璃（.dark 作用域下 glass 用深色变量，
  // 融入全屏页深色背景而非浅色主题的白玻璃），并下移避开全屏页顶部按钮栏
  const fullPlayerOpen = usePlayerStore((s) => s.showFullPlayer);
  // 专辑主色（与全屏页共用取色缓存）：正在播放行的歌名/波浪/高亮统一用它
  const accent = useDominantColor(currentSong ? getCoverUrl(currentSong) : null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIdx(idx);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropIdx(null);
  }, []);

  // 排序逻辑（含 queueIndex 同步修正）在 store.reorderQueue 中
  const handleDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
    setDragIdx(null);
    setDropIdx(null);
    if (isNaN(fromIdx) || fromIdx === toIdx) return;
    // 不可拖动付费歌曲
    if (queue[fromIdx]?.fee === 1 || queue[toIdx]?.fee === 1) return;
    reorderQueue(fromIdx, toIdx);
  }, [queue, reorderQueue]);

  const handleRemove = useCallback((e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    removeFromQueue(idx);
  }, [removeFromQueue]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDropIdx(null);
  }, []);

  // Esc 关闭面板（浮在全屏播放页上层时，全屏页会先检查本面板状态、不抢这次按键）
  useEffect(() => {
    if (!showQueue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowQueue(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showQueue, setShowQueue]);

  if (!showQueue) return null;

  return (
    <div className={fullPlayerOpen ? "dark" : undefined}>
      <div
        className={cn(
          "fixed right-3 w-80 rounded-[26px] z-[110] flex flex-col shadow-xl overflow-hidden",
          // 全屏页上用折射玻璃（透出专辑主色），主界面保持主题玻璃
          fullPlayerOpen ? "glass-refract" : "glass"
        )}
        style={{
          top: fullPlayerOpen ? "calc(4.5rem + var(--safe-top))" : "0.75rem",
          bottom: "calc(96px + var(--safe-bottom))",
        }}
      >
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <h3 className="font-semibold text-sm">
          播放队列
          <span className="text-muted-foreground ml-2">({queue.length})</span>
        </h3>
        <div className="flex items-center gap-1">
          {queue.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={clearQueue}
              title="清空队列（保留正在播放）"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer h-8 w-8"
            onClick={() => setShowQueue(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 歌曲列表 */}
      <div className="flex-1 overflow-y-auto p-2" onWheel={(e) => e.stopPropagation()}>
        {queue.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            播放队列为空
          </div>
        ) : (
          queue.map((song, index) => {
            const isCurrent = currentSong?.id === song.id;
            const isPaid = song.fee === 1;
            const isDragging = dragIdx === index;
            const isOver = dropIdx === index;
            // "正在播放"行统一用专辑主色（歌名/波浪/行高亮），主界面与全屏页一致
            const currentColor = accent ?? undefined;

            return (
              <div
                key={`${song.id}-${index}`}
                draggable={!isPaid}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded-lg transition-all group",
                  isCurrent && !currentColor && "bg-primary/15",
                  isDragging && "opacity-50",
                  isOver && (index > (dragIdx ?? -1) ? "border-t-2 border-primary/50" : "border-b-2 border-primary/50"),
                  isPaid ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted/30"
                )}
                style={isCurrent && currentColor ? ({
                  "--eq-bar-color": currentColor,
                  background: hexA(currentColor, 0.13),
                } as React.CSSProperties) : undefined}
                onClick={() => !isPaid && playSong(song, queue)}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                {/* 拖拽手柄 */}
                {!isPaid && (
                  <div className="shrink-0 opacity-0 group-hover:opacity-50 transition-opacity cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                )}

                {/* 序号 / EQ动画 */}
                <div className="w-5 text-center shrink-0">
                  {isPaid ? (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground mx-auto" />
                  ) : isCurrent ? (
                    <div className="flex items-end justify-center h-4 gap-[2px]">
                      <span className="eq-bar" style={{ height: "60%" }} />
                      <span className="eq-bar" style={{ height: "80%" }} />
                      <span className="eq-bar" style={{ height: "40%" }} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                  )}
                </div>

                {/* 封面 */}
                <div className="w-8 h-8 shrink-0 rounded overflow-hidden">
                  {getCoverUrl(song) ? (
                    <img
                      src={getCoverUrl(song) + "?param=60y60"}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={cn("w-full h-full object-cover", isPaid && "grayscale")}
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Lock className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                {/* 歌曲信息 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p
                      className={cn("text-sm truncate", isCurrent && !currentColor && "text-primary font-medium", isPaid && "text-muted-foreground")}
                      style={currentColor && isCurrent ? { color: currentColor, fontWeight: 500 } : undefined}
                    >
                      {song.name}
                    </p>
                    {isPaid && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">VIP</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{song.artists?.map((a) => a.name).join(" / ")}</p>
                </div>

                {/* 移除单曲（正在播放的不可移除） */}
                {!isCurrent && !isPaid && (
                  <button
                    className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleRemove(e, index)}
                    title="从队列移除"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
}

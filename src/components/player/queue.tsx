"use client";

import { useState, useCallback } from "react";
import { X, Lock, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlayerStore } from "@/lib/store";
import { cn, getCoverUrl } from "@/lib/utils";
import type { Song } from "@/lib/types";

export function PlayQueue() {
  const { queue, currentSong, playSong, showQueue, setShowQueue, setQueue, queueIndex } =
    usePlayerStore();
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

  const handleDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
    if (isNaN(fromIdx) || fromIdx === toIdx) {
      setDragIdx(null);
      setDropIdx(null);
      return;
    }

    // 不可拖动付费歌曲
    if (queue[fromIdx]?.fee === 1 || queue[toIdx]?.fee === 1) {
      setDragIdx(null);
      setDropIdx(null);
      return;
    }

    const reordered = [...queue];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    setQueue(reordered);
    setDragIdx(null);
    setDropIdx(null);
  }, [queue, setQueue]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDropIdx(null);
  }, []);

  if (!showQueue) return null;

  return (
    <div className="fixed right-0 top-0 bottom-20 w-80 glass z-[55] flex flex-col shadow-xl">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <h3 className="font-semibold text-sm">
          播放队列
          <span className="text-muted-foreground ml-2">({queue.length})</span>
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer h-8 w-8"
          onClick={() => setShowQueue(false)}
        >
          <X className="h-4 w-4" />
        </Button>
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

            return (
              <div
                key={`${song.id}-${index}`}
                draggable={!isPaid}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded-lg transition-all group",
                  isCurrent && "bg-primary/15",
                  isDragging && "opacity-50",
                  isOver && (index > (dragIdx ?? -1) ? "border-t-2 border-primary/50" : "border-b-2 border-primary/50"),
                  isPaid ? "opacity-45 cursor-not-allowed" : "cursor-pointer hover:bg-muted/30"
                )}
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
                    <p className={cn("text-sm truncate", isCurrent && "text-primary font-medium", isPaid && "text-muted-foreground")}>
                      {song.name}
                    </p>
                    {isPaid && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-amber-500/40 text-amber-500 shrink-0">VIP</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{song.artists?.map((a) => a.name).join(" / ")}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

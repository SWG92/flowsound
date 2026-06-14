"use client";

import { X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlayerStore } from "@/lib/store";
import { cn, getCoverUrl } from "@/lib/utils";

export function PlayQueue() {
  const { queue, currentSong, playSong, showQueue, setShowQueue } =
    usePlayerStore();

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
      <div
        className="flex-1 overflow-y-auto p-2"
        onWheel={(e) => e.stopPropagation()}
      >
        {queue.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            播放队列为空
          </div>
        ) : (
          queue.map((song, index) => {
            const isCurrent = currentSong?.id === song.id;
            const isPaid = song.fee === 1;

            return (
              <div
                key={`${song.id}-${index}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  isCurrent && "bg-primary/15",
                  isPaid
                    ? "opacity-45 cursor-not-allowed"
                    : "cursor-pointer hover:bg-muted/30"
                )}
                onClick={() => !isPaid && playSong(song, queue)}
              >
                {/* 序号 / EQ动画 */}
                <div className="w-6 text-center shrink-0">
                  {isPaid ? (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground mx-auto" />
                  ) : isCurrent ? (
                    <div className="flex items-end justify-center h-4 gap-[2px]">
                      <span className="eq-bar" style={{ height: "60%" }} />
                      <span className="eq-bar" style={{ height: "80%" }} />
                      <span className="eq-bar" style={{ height: "40%" }} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* 封面 */}
                {getCoverUrl(song) ? (
                  <img
                    src={getCoverUrl(song) + "?param=60y60"}
                    alt=""
                    className={cn("w-9 h-9 rounded object-cover shrink-0", isPaid && "grayscale")}
                  />
                ) : (
                  <div className="w-9 h-9 rounded bg-muted shrink-0 flex items-center justify-center">
                    <Lock className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                )}

                {/* 歌曲信息 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={cn(
                        "text-sm truncate",
                        isCurrent && "text-primary font-medium",
                        isPaid && "text-muted-foreground"
                      )}
                    >
                      {song.name}
                    </p>
                    {isPaid && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-amber-500/40 text-amber-500 shrink-0">
                        VIP
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {song.artists?.map((a) => a.name).join(" / ")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, Trash2, Flame, History as HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SongList } from "@/components/playlist/song-list";
import { usePlayerStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function HistoryPage() {
  const { playHistory, clearHistory, playCounts } = usePlayerStore();
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"recent" | "top">("recent");
  useEffect(() => setMounted(true), []);

  // 听歌排行：按播放次数排序（歌曲对象从播放历史中取，播放过的歌几乎都在历史里）
  const topSongs = useMemo(() => {
    return playHistory
      .map((song) => ({ song, count: playCounts[song.id] || 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map((x) => x.song);
  }, [playHistory, playCounts]);

  const count = mounted ? playHistory.length : 0;
  const showContent = mounted && view === "recent" && playHistory.length > 0;
  const showTop = mounted && view === "top" && topSongs.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            <span className="gradient-text">播放记录</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {view === "recent" ? `${count} 首歌曲` : `最常播放的 ${topSongs.length} 首`}
          </p>
        </div>
        {showContent && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            className="cursor-pointer"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            清空
          </Button>
        )}
      </div>

      {/* 视图切换 */}
      <div className="flex gap-1 p-1 rounded-lg bg-black/5 dark:bg-white/5 w-fit">
        <button
          onClick={() => setView("recent")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm transition-colors cursor-pointer",
            view === "recent"
              ? "bg-background shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          最近播放
        </button>
        <button
          onClick={() => setView("top")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm transition-colors cursor-pointer",
            view === "top"
              ? "bg-background shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Flame className="h-3.5 w-3.5" />
          最常播放
        </button>
      </div>

      {view === "recent" ? (
        showContent ? (
          <SongList songs={playHistory} showIndex showAlbum virtual />
        ) : mounted ? (
          <div className="text-center py-20 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-2">还没有播放记录</p>
            <p className="text-sm">播放歌曲后会自动记录</p>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">加载中...</p>
          </div>
        )
      ) : showTop ? (
        <SongList songs={topSongs} showIndex showAlbum virtual />
      ) : mounted ? (
        <div className="text-center py-20 text-muted-foreground">
          <Flame className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">还没有排行数据</p>
          <p className="text-sm">多听几首歌，这里会出现你最常播放的音乐</p>
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-sm">加载中...</p>
        </div>
      )}
    </div>
  );
}

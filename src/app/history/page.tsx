"use client";

import { useState, useEffect } from "react";
import { Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SongList } from "@/components/playlist/song-list";
import { usePlayerStore } from "@/lib/store";

export default function HistoryPage() {
  const { playHistory, clearHistory } = usePlayerStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = mounted ? playHistory.length : 0;
  const showContent = mounted && playHistory.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            <span className="gradient-text">最近播放</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count} 首歌曲
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

      {showContent ? (
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
      )}
    </div>
  );
}

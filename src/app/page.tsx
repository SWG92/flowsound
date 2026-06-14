"use client";

import { useEffect, useState } from "react";
import { Flame, TrendingUp, Sparkles, Play } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SongList } from "@/components/playlist/song-list";
import { SearchBar } from "@/components/search/search-bar";
import { getHotSongs, getRisingSongs, getNewSongs } from "@/lib/api";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { logWarn } from "@/lib/logger";
import type { Song } from "@/lib/types";

export default function Home() {
  const [hotSongs, setHotSongs] = useState<Song[]>([]);
  const [risingSongs, setRisingSongs] = useState<Song[]>([]);
  const [newSongs, setNewSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const { setQueue, playSong } = usePlayerStore();
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [hot, rising, newRes] = await Promise.allSettled([
        getHotSongs(),
        getRisingSongs(),
        getNewSongs(),
      ]);
      if (cancelled) return;
      if (hot.status === "fulfilled") setHotSongs(hot.value);
      if (rising.status === "fulfilled") setRisingSongs(rising.value);
      if (newRes.status === "fulfilled") setNewSongs(newRes.value);

      const failures = [hot, rising, newRes].filter(
        (r) => r.status === "rejected"
      );
      if (failures.length > 0) {
        logWarn("部分榜单数据加载失败:", failures.length);
        if (failures.length === 3) {
          showToast("加载榜单数据失败，请检查网络", "error");
        }
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handlePlayAll = (songList: Song[]) => {
    if (songList.length === 0) return;
    setQueue(songList);
    playSong(songList[0], songList);
  };

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div>
        <h1 className="text-2xl font-bold">
          <span className="gradient-text">发现音乐</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          海量音乐，随时畅听
        </p>
        <div className="mt-3">
          <SearchBar />
        </div>
      </div>

      {/* 排行榜 */}
      <Tabs defaultValue="hot" className="gap-0!">
        <div className="flex items-center justify-between mb-1">
          <TabsList className="bg-black/5">
            <TabsTrigger value="hot" className="cursor-pointer">
              <Flame className="h-4 w-4 mr-1.5" />
              热歌榜
            </TabsTrigger>
            <TabsTrigger value="rising" className="cursor-pointer">
              <TrendingUp className="h-4 w-4 mr-1.5" />
              飙升榜
            </TabsTrigger>
            <TabsTrigger value="new" className="cursor-pointer">
              <Sparkles className="h-4 w-4 mr-1.5" />
              新歌榜
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="hot">
          {loading ? (
            <SkeletonList />
          ) : (
            <>
              <PlayAllBtn onClick={() => handlePlayAll(hotSongs)} />
              <SongList songs={hotSongs} />
            </>
          )}
        </TabsContent>

        <TabsContent value="rising">
          {loading ? (
            <SkeletonList />
          ) : (
            <>
              <PlayAllBtn onClick={() => handlePlayAll(risingSongs)} />
              <SongList songs={risingSongs} />
            </>
          )}
        </TabsContent>

        <TabsContent value="new">
          {loading ? (
            <SkeletonList />
          ) : (
            <>
              <PlayAllBtn onClick={() => handlePlayAll(newSongs)} />
              <SongList songs={newSongs} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-2">
          <Skeleton className="w-8 h-4 bg-white/5" />
          <Skeleton className="flex-1 h-10 bg-white/5" />
          <Skeleton className="w-16 h-4 bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function PlayAllBtn({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-end mb-1">
      <Button variant="outline" size="sm" onClick={onClick} className="cursor-pointer">
        <Play className="h-4 w-4 mr-1.5" />播放全部
      </Button>
    </div>
  );
}

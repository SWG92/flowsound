"use client";

import { useEffect, useState } from "react";
import { Flame, TrendingUp, Sparkles, Play, WifiOff, RotateCw } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"hot" | "rising" | "new">("hot");
  const songsFor = (t: "hot" | "rising" | "new") =>
    t === "hot" ? hotSongs : t === "rising" ? risingSongs : newSongs;
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // 只订阅用到的 action：播放进度等 store 变化不再引发首页重渲染
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playSong = usePlayerStore((s) => s.playSong);
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    setLoadFailed(false);
    const [hot, rising, newRes] = await Promise.allSettled([
      getHotSongs(),
      getRisingSongs(),
      getNewSongs(),
    ]);
    if (hot.status === "fulfilled") setHotSongs(hot.value);
    if (rising.status === "fulfilled") setRisingSongs(rising.value);
    if (newRes.status === "fulfilled") setNewSongs(newRes.value);

    const failures = [hot, rising, newRes].filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      logWarn("部分榜单数据加载失败:", failures.length);
      if (failures.length === 3) {
        setLoadFailed(true);
        showToast("加载榜单数据失败，请检查网络", "error");
      }
    }
    setLoading(false);
  };

  // 首次加载（load 内部有 setLoadFailed 等状态，延迟到 effect 中调用）
  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首挂载加载，重试由按钮手动触发
  }, []);

  const handlePlayAll = (songList: Song[]) => {
    if (songList.length === 0) return;
    setQueue(songList);
    playSong(songList[0], songList, songList);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      {/* 头部 */}
      <div>
        <h1 className="text-2xl font-bold">
          <span className="gradient-text">发现音乐</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          让音乐流动起来 · 网易云 / QQ / 酷狗全聚合
        </p>
        <div className="mt-3">
          <SearchBar />
        </div>
      </div>

      {/* 排行榜 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "hot" | "rising" | "new")} className="gap-0! flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1 shrink-0">
          <TabsList className="bg-black/5">
            <TabsTrigger value="hot" className="cursor-pointer text-xs md:text-sm data-active:bg-primary/10 data-active:text-primary rounded-md">
              <Flame className="h-4 w-4 mr-1 md:mr-1.5" />
              <span className="hidden sm:inline">热歌榜</span>
            </TabsTrigger>
            <TabsTrigger value="rising" className="cursor-pointer text-xs md:text-sm data-active:bg-primary/10 data-active:text-primary rounded-md">
              <TrendingUp className="h-4 w-4 mr-1 md:mr-1.5" />
              <span className="hidden sm:inline">飙升榜</span>
            </TabsTrigger>
            <TabsTrigger value="new" className="cursor-pointer text-xs md:text-sm data-active:bg-primary/10 data-active:text-primary rounded-md">
              <Sparkles className="h-4 w-4 mr-1 md:mr-1.5" />
              <span className="hidden sm:inline">新歌榜</span>
            </TabsTrigger>
          </TabsList>
          {/* 播放全部并入胶囊行（跟随当前榜单），消除独立按钮行的空白带 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePlayAll(songsFor(activeTab))}
            disabled={loading || songsFor(activeTab).length === 0}
            className="cursor-pointer"
          >
            <Play className="h-4 w-4 mr-1.5" />
            播放全部
          </Button>
        </div>

        <TabsContent value="hot" className="flex-1 min-h-0 flex flex-col">
          {loading ? (
            <SkeletonList />
          ) : loadFailed ? (
            <LoadFailed onRetry={load} />
          ) : (
            <div className="flex-1 min-h-0"><SongList songs={hotSongs} virtual fill /></div>
          )}
        </TabsContent>

        <TabsContent value="rising" className="flex-1 min-h-0 flex flex-col">
          {loading ? (
            <SkeletonList />
          ) : (
            <div className="flex-1 min-h-0"><SongList songs={risingSongs} virtual fill /></div>
          )}
        </TabsContent>

        <TabsContent value="new" className="flex-1 min-h-0 flex flex-col">
          {loading ? (
            <SkeletonList />
          ) : (
            <div className="flex-1 min-h-0"><SongList songs={newSongs} virtual fill /></div>
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

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 text-muted-foreground">
      <WifiOff className="h-10 w-10 mb-3 opacity-40" />
      <p className="mb-4">榜单加载失败，请检查网络后重试</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="cursor-pointer">
        <RotateCw className="h-4 w-4 mr-1.5" />
        重新加载
      </Button>
    </div>
  );
}

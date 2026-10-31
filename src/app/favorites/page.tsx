"use client";

import { useState, useEffect, useMemo } from "react";
import { Heart, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SongList } from "@/components/playlist/song-list";
import { SongSearchInput, filterSongs } from "@/components/playlist/song-search";
import { usePlayerStore } from "@/lib/store";

export default function FavoritesPage() {
  // 字段级订阅：播放进度等 store 变化不再引发收藏页重渲染
  const favoriteSongs = usePlayerStore((s) => s.favoriteSongs);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playSong = usePlayerStore((s) => s.playSong);
  // 避免 hydration 不匹配：favorites 来自 localStorage，SSR 时为 []
  const [mounted, setMounted] = useState(false);
  // 收藏内搜索（歌曲多时快速定位）
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const count = mounted ? favoriteSongs.length : 0;
  const displaySongs = useMemo(
    () => (mounted ? filterSongs(favoriteSongs, search) : []),
    [favoriteSongs, search, mounted]
  );

  const handlePlayAll = () => {
    if (displaySongs.length === 0) return;
    setQueue(displaySongs);
    playSong(displaySongs[0], displaySongs, displaySongs);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            <span className="gradient-text">我喜欢的</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {search.trim()
              ? `${displaySongs.length} / ${count} 首歌曲`
              : `${count} 首歌曲`}
          </p>
        </div>
        {mounted && favoriteSongs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayAll}
            disabled={displaySongs.length === 0}
            className="cursor-pointer"
          >
            <Play className="h-4 w-4 mr-1.5" />
            播放全部
          </Button>
        )}
      </div>

      {mounted && favoriteSongs.length >= 10 && (
        <SongSearchInput value={search} onChange={setSearch} placeholder="在收藏中搜索歌名、歌手、专辑..." />
      )}

      {mounted && displaySongs.length > 0 ? (
        <SongList songs={displaySongs} showIndex showAlbum virtual />
      ) : mounted && favoriteSongs.length > 0 && search.trim() ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">没有匹配「{search.trim()}」的收藏歌曲</p>
        </div>
      ) : mounted ? (
        <div className="text-center py-20 text-muted-foreground">
          <Heart className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">还没有收藏歌曲</p>
          <p className="text-sm">在搜索或播放时点击心形图标收藏</p>
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-sm">加载中...</p>
        </div>
      )}
    </div>
  );
}

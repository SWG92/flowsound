"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { SongList } from "@/components/playlist/song-list";
import { usePlayerStore } from "@/lib/store";

export default function FavoritesPage() {
  const { favoriteSongs } = usePlayerStore();
  // 避免 hydration 不匹配：favorites 来自 localStorage，SSR 时为 []
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = mounted ? favoriteSongs.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="h-6 w-6 text-red-500 fill-red-500" />
          <span className="gradient-text">我喜欢的</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {count} 首歌曲
        </p>
      </div>

      {mounted && favoriteSongs.length > 0 ? (
        <SongList songs={favoriteSongs} showIndex showAlbum />
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

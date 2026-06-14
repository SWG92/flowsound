"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SongList } from "@/components/playlist/song-list";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { RECOMMEND_PLAYLISTS, STORAGE_KEYS } from "@/lib/constants";
import { logWarn } from "@/lib/logger";
import type { Song } from "@/lib/types";

function loadCachedSongs(): { songs: Song[]; date: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.dailyRecommend);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // ignore
  }
  return null;
}

function saveCachedSongs(songs: Song[]) {
  const today = new Date().toLocaleDateString("zh-CN"); // 使用本地日期
  localStorage.setItem(
    STORAGE_KEYS.dailyRecommend,
    JSON.stringify({ songs, date: today })
  );
}

// Fisher-Yates 洗牌算法
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function DailyRecommend() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { setQueue, playSong } = usePlayerStore();
  const { showToast } = useToast();

  // 加载推荐歌曲（优先使用缓存）
  const loadSongs = useCallback(async (forceRefresh = false) => {
    setLoading(true);

    // 检查缓存
    if (!forceRefresh) {
      const cached = loadCachedSongs();
      if (cached && cached.songs.length > 0) {
        setSongs(cached.songs);
        setLoading(false);
        return;
      }
    }

    try {
      setIsRefreshing(true);
      // 随机选一个歌单
      const playlistId =
        RECOMMEND_PLAYLISTS[
          Math.floor(Math.random() * RECOMMEND_PLAYLISTS.length)
        ];
      const res = await fetch(
        `/api/music?fn=playlist/detail&id=${playlistId}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { result?: { tracks: Song[] }; playlist?: { tracks: Song[] } };
      const tracks: Song[] = data.result?.tracks || data.playlist?.tracks || [];
      // 使用 Fisher-Yates 洗牌
      const newSongs = shuffle(tracks).slice(0, 30);
      setSongs(newSongs);
      saveCachedSongs(newSongs);
    } catch (err) {
      logWarn("Failed to load daily recommendations:", err);
      setSongs([]);
      showToast("加载推荐失败，请检查网络后重试", "error");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSongs(false);
  }, [loadSongs]);

  const handleRefresh = () => {
    loadSongs(true);
  };

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    setQueue(songs);
    playSong(songs[0], songs);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 bg-black/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">每日推荐</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayAll}
            className="cursor-pointer"
          >
            <Play className="h-4 w-4 mr-1.5" />
            播放全部
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>
      <SongList songs={songs} showIndex showAlbum={false} />
    </div>
  );
}

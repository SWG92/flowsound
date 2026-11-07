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
import { searchSongs } from "@/lib/api";
import type { Song } from "@/lib/types";

// 跨平台推荐的热门歌手池：每日按日期轮换 2 位，分别搜索 QQ/酷狗取热门曲目，
// 与网易云歌单混合——弥补 QQ/酷狗歌单接口已封死、无法直接拿歌单的缺口
const HOT_ARTISTS = [
  "周杰伦", "邓紫棋", "林俊杰", "薛之谦", "Taylor Swift",
  "毛不易", "告五人", "陈奕迅", "王心凌", "许嵩",
  "李荣浩", "五月天", "张韶涵", "华晨宇", "蔡依林",
];

/** 按日期确定性选择今日歌手（同一天稳定，跨天轮换） */
function pickDailyArtists(date: string): string[] {
  let seed = 0;
  for (const ch of date) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const a = HOT_ARTISTS[seed % HOT_ARTISTS.length];
  const b = HOT_ARTISTS[(Math.floor(seed / HOT_ARTISTS.length) + seed * 7) % HOT_ARTISTS.length];
  return a === b ? [a] : [a, b];
}

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
  // 只订阅用到的 action：播放进度等 store 变化不再引发每日推荐重渲染
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playSong = usePlayerStore((s) => s.playSong);
  const { showToast } = useToast();

  // 加载推荐歌曲（优先使用缓存）
  const loadSongs = useCallback(async (forceRefresh = false) => {
    setLoading(true);

    // 检查缓存（只在"今天"的缓存有效，跨天自动刷新）
    if (!forceRefresh) {
      const cached = loadCachedSongs();
      const today = new Date().toLocaleDateString("zh-CN");
      if (cached && cached.songs.length > 0 && cached.date === today) {
        setSongs(cached.songs);
        setLoading(false);
        return;
      }
    }

    try {
      setIsRefreshing(true);
      // 主体：随机选一个网易云歌单
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

      // 多平台混合：每日按日期轮换热门歌手，分别在 QQ/酷狗搜索热门曲目，
      // 与网易云歌单歌曲合并（去重）——QQ/酷狗的歌单接口已封死，搜索是唯一可行通道
      const today = new Date().toLocaleDateString("zh-CN");
      const artists = pickDailyArtists(today);
      const extra = await Promise.allSettled([
        searchSongs(artists[0], 1, 5, "qq"),
        artists[1] ? searchSongs(artists[1], 1, 5, "kugou") : Promise.resolve({ songs: [], total: 0, hasMore: false }),
      ]);
      const known = new Set(tracks.map((t) => `${t.name}|${t.artists?.[0]?.name ?? ""}`));
      const mixed: Song[] = [];
      for (const r of extra) {
        if (r.status !== "fulfilled") continue;
        for (const s of r.value.songs) {
          const key = `${s.name}|${s.artists?.[0]?.name ?? ""}`;
          if (!known.has(key)) {
            known.add(key);
            mixed.push(s);
          }
        }
      }

      // 合并去重后统一洗牌，取 30 首
      const newSongs = shuffle([...tracks, ...mixed]).slice(0, 30);
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
    const t = setTimeout(() => loadSongs(false), 0);
    return () => clearTimeout(t);
  }, [loadSongs]);

  const handleRefresh = () => {
    loadSongs(true);
  };

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    setQueue(songs);
    playSong(songs[0], songs, songs);
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
      <SongList songs={songs} showIndex showAlbum={false} virtual />
    </div>
  );
}

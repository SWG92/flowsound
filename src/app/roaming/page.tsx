"use client";

import { useState, useEffect, useCallback } from "react";
import { Radio, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SongList } from "@/components/playlist/song-list";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Song } from "@/lib/types";
import {
  ROAMING_GENRES,
  buildRoamingPool,
  type RoamingGenre,
} from "@/lib/roaming";

/**
 * 音乐漫游：选一个流派 → 生成漫游曲池 → 无限播放。
 * 曲池 = 该流派精选歌单合并去重洗牌；播放走现有队列机制，
 * 队列尾部自动绕回 → 天然无限漫游；刷新后播放快照恢复队列不中断。
 */
export default function RoamingPage() {
  const [genre, setGenre] = useState<RoamingGenre | null>(null);
  const [pool, setPool] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playSong = usePlayerStore((s) => s.playSong);
  const { showToast } = useToast();

  const loadPool = useCallback(
    async (g: RoamingGenre) => {
      setLoading(true);
      setError(false);
      setPool([]);
      try {
        const songs = await buildRoamingPool(g);
        if (songs.length === 0) throw new Error("empty");
        // 只更新展示列表，不动队列——选流派就该看到该流派的歌单；
        // 入队发生在「开始漫游」或点击列表行，不打断正在播的歌
        setPool(songs);
      } catch {
        setError(true);
        showToast("漫游曲池拉取失败，请重试或换个流派", "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  const startRoaming = () => {
    if (pool.length === 0) return;
    setQueue(pool);
    playSong(pool[0], pool, pool);
    showToast(`开始漫游「${genre?.label}」· ${pool.length} 首已入列`, "success");
  };

  // 刷新/切页后恢复上次选的流派，并拉取该流派的真实歌单展示
  // （不再镜像当前播放队列——那是"现在播什么就显示什么"的病根；
  //   队列不受影响，正在播的歌不打断）
  // 延后一拍：effect 内同步 setState 会触发级联渲染（React Compiler 规则）
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const last = localStorage.getItem("flowsound_roaming_genre");
        if (!last) return;
        const g = ROAMING_GENRES.find((x) => x.id === last);
        if (g) {
          setGenre(g);
          loadPool(g);
        }
      } catch { /* ignore */ }
    }, 0);
    return () => clearTimeout(t);
  }, [loadPool]);

  const selectGenre = (g: RoamingGenre) => {
    setGenre(g);
    try { localStorage.setItem("flowsound_roaming_genre", g.id); } catch { /* ignore */ }
    loadPool(g);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="gradient-text">音乐漫游</span>
          <Radio className="h-5 w-5 text-primary" />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          选一个流派，让音乐带你漂
        </p>
      </div>

      {/* 流派胶囊墙 */}
      <div className="flex flex-wrap gap-2.5 shrink-0">
        {ROAMING_GENRES.map((g) => (
          <button
            key={g.id}
            onClick={() => selectGenre(g)}
            className={cn(
              "px-4 py-2 rounded-full text-sm cursor-pointer transition-all border",
              genre?.id === g.id
                ? "bg-primary/15 text-primary font-medium border-primary/40"
                : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/30 hover:bg-white/5"
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* 选中流派描述 */}
      {genre && (
        <p className="text-xs text-muted-foreground/80 shrink-0">{genre.desc}</p>
      )}

      {/* 曲池区域 */}
      {loading ? (
        <div className="space-y-3 shrink-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 bg-black/5" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          曲池拉取失败，点击上面的流派重试
        </div>
      ) : pool.length > 0 ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-end shrink-0 pb-2">
            <Button size="sm" onClick={startRoaming} className="cursor-pointer">
              <Play className="h-4 w-4 mr-1.5" />
              开始漫游
            </Button>
          </div>
          {/* 填充模式：页面固定高度，滚轮只作用于歌单列表 */}
          <div className="flex-1 min-h-0">
            <SongList songs={pool} showIndex showAlbum={false} virtual fill />
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-8 text-center">
          点击上面任意流派，开启一场不设终点的听觉漫游
        </div>
      )}
    </div>
  );
}

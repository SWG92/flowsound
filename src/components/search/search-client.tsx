"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/search/search-bar";
import { SongList } from "@/components/playlist/song-list";
import { Skeleton } from "@/components/ui/skeleton";
import { searchAllPlatforms, getHotSongs } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { logError } from "@/lib/logger";
import { Flame } from "lucide-react";
import type { Song } from "@/lib/types";

const PAGE_SIZE = 30;

export function SearchClient({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const query = initialQuery;

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hotKeywords, setHotKeywords] = useState<string[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // 搜索代际号：快速切换关键词时丢弃过期响应，防止旧结果追加到新结果后面
  const searchGenRef = useRef(0);
  const { showToast } = useToast();

  const doSearch = useCallback(
    async (q: string, p: number = 1) => {
      if (!q.trim()) return;
      const gen = ++searchGenRef.current;
      if (p === 1) setSongs([]); // 换关键词时先清空，避免旧结果闪烁
      setLoading(true);
      try {
        const result = await searchAllPlatforms(q, p, PAGE_SIZE);
        if (gen !== searchGenRef.current) return;
        setSongs(p === 1 ? result.songs : (prev) => [...prev, ...result.songs]);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setPage(p);
      } catch (error) {
        logError("搜索失败:", error);
        if (gen === searchGenRef.current) {
          showToast("搜索失败，请检查网络后重试", "error");
        }
      } finally {
        if (gen === searchGenRef.current) setLoading(false);
      }
    },
    [showToast]
  );

  // 关键词变化时重新搜索（服务端导航会传入新的 initialQuery）
  useEffect(() => {
    if (query) {
      doSearch(query, 1);
    } else {
      setSongs([]);
      setTotal(0);
      setHasMore(false);
    }
  }, [query, doSearch]);

  // 空状态下展示"大家都在搜"（取自热歌榜歌手，无需额外接口）
  useEffect(() => {
    if (query) return;
    let cancelled = false;
    getHotSongs()
      .then((hot) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const kws: string[] = [];
        for (const s of hot) {
          const name = s.artists?.[0]?.name;
          if (name && !seen.has(name)) {
            seen.add(name);
            kws.push(name);
          }
          if (kws.length >= 10) break;
        }
        setHotKeywords(kws);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [query]);

  // 无限滚动
  useEffect(() => {
    if (!hasMore || loading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          doSearch(query, page + 1);
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, query, page, doSearch]);

  const handleSearch = (q: string) => {
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">
          <span className="gradient-text">搜索</span>
        </h1>
        <SearchBar defaultValue={query} onSearch={handleSearch} />
      </div>

      {query && (
        <p className="text-sm text-muted-foreground">
          {loading && songs.length === 0
            ? "全平台搜索中..."
            : `找到 ${total} 首歌曲`}
        </p>
      )}

      {loading && songs.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2">
              <Skeleton className="w-8 h-4 bg-white/5" />
              <Skeleton className="flex-1 h-10 bg-white/5" />
              <Skeleton className="w-16 h-4 bg-white/5" />
            </div>
          ))}
        </div>
      ) : songs.length > 0 ? (
        <>
          <SongList songs={songs} virtual />
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loading && (
                <span className="text-sm text-muted-foreground">加载中...</span>
              )}
            </div>
          )}
        </>
      ) : query ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg mb-2">未找到相关歌曲</p>
          <p className="text-sm">试试其他关键词</p>
        </div>
      ) : (
        <div className="text-center py-14 text-muted-foreground">
          <p className="text-lg mb-2">输入关键词搜索</p>
          <p className="text-sm">全平台聚合搜索 · 网易云 + QQ音乐 + 酷狗</p>
          {hotKeywords.length > 0 && (
            <div className="mt-6 max-w-xl mx-auto">
              <p className="text-xs flex items-center justify-center gap-1 mb-3">
                <Flame className="h-3 w-3 text-orange-400" />
                大家都在搜
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {hotKeywords.map((kw, i) => (
                  <button
                    key={kw}
                    onClick={() => handleSearch(kw)}
                    className="px-3 py-1.5 rounded-full glass text-sm hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {i < 3 && (
                      <span className={`text-xs font-bold ${i === 0 ? "text-orange-500" : i === 1 ? "text-amber-500" : "text-yellow-500"}`}>
                        {i + 1}
                      </span>
                    )}
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

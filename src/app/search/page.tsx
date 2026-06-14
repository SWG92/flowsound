"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchBar } from "@/components/search/search-bar";
import { SongList } from "@/components/playlist/song-list";
import { Skeleton } from "@/components/ui/skeleton";
import { searchAllPlatforms } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { logError } from "@/lib/logger";
import type { Song } from "@/lib/types";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const doSearch = useCallback(
    async (q: string, p: number = 1) => {
      if (!q.trim()) return;
      setLoading(true);
      try {
        const result = await searchAllPlatforms(q, p, 30);
        setSongs(p === 1 ? result.songs : (prev) => [...prev, ...result.songs]);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setPage(p);
      } catch (error) {
        logError("搜索失败:", error);
        showToast("搜索失败，请检查网络后重试", "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (query) {
      doSearch(query, 1);
    }
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <SearchBar defaultValue={query} onSearch={handleSearch} autoFocus />
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
          <SongList songs={songs} />
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
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg mb-2">输入关键词搜索</p>
          <p className="text-sm">全平台聚合搜索 · 网易云 + QQ音乐 + 酷狗</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-muted-foreground">加载中...</div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

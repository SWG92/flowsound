"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Clock, UserRound, Music2, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchStore } from "@/lib/search-store";
import { searchSuggest, type SearchSuggest } from "@/lib/api";

interface SearchBarProps {
  defaultValue?: string;
  onSearch?: (query: string) => void;
  autoFocus?: boolean;
}

export function SearchBar({
  defaultValue = "",
  onSearch,
  autoFocus,
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const [showHistory, setShowHistory] = useState(false);
  const [suggest, setSuggest] = useState<SearchSuggest>({ artists: [], songs: [] });
  const suggestGenRef = useRef(0);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const history = useSearchStore((s) => s.history);
  const addToHistory = useSearchStore((s) => s.addToHistory);
  const removeFromHistory = useSearchStore((s) => s.removeFromHistory);
  const clearHistory = useSearchStore((s) => s.clearHistory);

  const hasSuggest = suggest.artists.length > 0 || suggest.songs.length > 0;

  const handleSearch = useCallback(
    (q?: string) => {
      const searchQuery = (q || query).trim();
      if (!searchQuery) return;

      addToHistory(searchQuery);
      setShowHistory(false);

      if (onSearch) {
        onSearch(searchQuery);
      } else {
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      }
    },
    [query, onSearch, router, addToHistory]
  );

  // 输入联想：300ms 防抖 + 代际号防竞态（旧响应不覆盖新输入）
  useEffect(() => {
    const kw = query.trim();
    if (!kw) {
      // 清空联想也延后一拍，避免同步 setState 触发级联渲染告警
      const clear = setTimeout(() => setSuggest({ artists: [], songs: [] }), 0);
      return () => clearTimeout(clear);
    }
    const gen = ++suggestGenRef.current;
    const t = setTimeout(async () => {
      const result = await searchSuggest(kw);
      if (gen === suggestGenRef.current) setSuggest(result);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // 点击外部关闭历史面板
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowHistory(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            onFocus={() => setShowHistory(true)}
            placeholder="搜索歌曲、歌手、专辑..."
            className="pl-9 pr-8 bg-white/40 border-black/5 backdrop-blur-sm"
            autoFocus={autoFocus}
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 cursor-pointer"
              onClick={() => setQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Button
          onClick={() => handleSearch()}
          className="cursor-pointer"
          disabled={!query.trim()}
        >
          搜索
        </Button>
      </div>

      {/* 搜索联想（输入时）/ 搜索历史（聚焦未输入时） */}
      {showHistory && (hasSuggest || history.length > 0) && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 glass rounded-lg shadow-lg overflow-hidden">
          {query.trim() && hasSuggest ? (
            /* 联想列表 */
            <div className="py-1 max-h-72 overflow-y-auto">
              {suggest.artists.length > 0 && (
                <>
                  <p className="px-4 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />歌手
                  </p>
                  {suggest.artists.map((a) => (
                    <div
                      key={"a-" + a.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => {
                        setQuery(a.name);
                        handleSearch(a.name);
                      }}
                    >
                      <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{a.name}</span>
                      <span className="text-[10px] text-muted-foreground">歌手</span>
                    </div>
                  ))}
                </>
              )}
              {suggest.songs.length > 0 && (
                <>
                  <p className="px-4 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Music2 className="h-3 w-3" />歌曲
                  </p>
                  {suggest.songs.map((s, i) => (
                    <div
                      key={"s-" + i}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => {
                        const q = s.artist ? `${s.name} ${s.artist}` : s.name;
                        setQuery(q);
                        handleSearch(q);
                      }}
                    >
                      <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">
                        {s.name}
                        <span className="text-muted-foreground"> - {s.artist}</span>
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : history.length > 0 ? (
            /* 搜索历史 */
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  搜索历史
                </span>
                <button
                  onClick={clearHistory}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  清除全部
                </button>
              </div>
              <div className="py-1">
                {history.map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <span
                      className="text-sm flex-1 truncate"
                      onClick={() => {
                        setQuery(item);
                        handleSearch(item);
                      }}
                    >
                      {item}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(item);
                      }}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-2"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

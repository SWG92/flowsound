"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchStore } from "@/lib/search-store";

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
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const history = useSearchStore((s) => s.history);
  const addToHistory = useSearchStore((s) => s.addToHistory);
  const removeFromHistory = useSearchStore((s) => s.removeFromHistory);
  const clearHistory = useSearchStore((s) => s.clearHistory);

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

      {/* 搜索历史下拉 */}
      {showHistory && history.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 glass rounded-lg shadow-lg overflow-hidden">
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
        </div>
      )}
    </div>
  );
}

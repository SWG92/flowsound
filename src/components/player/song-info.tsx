"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { searchSongs } from "@/lib/api";
import { usePlayerStore } from "@/lib/store";
import { Play, Sparkles } from "lucide-react";
import { cn, getCoverUrl } from "@/lib/utils";
import type { Song } from "@/lib/types";

interface SongInfoDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDuration(ms: number | undefined): string {
  if (typeof ms !== "number" || isNaN(ms) || ms < 0) return "--:--";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function SongInfoDialog({ song, open, onOpenChange }: SongInfoDialogProps) {
  const [similar, setSimilar] = useState<Song[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const playSong = usePlayerStore((s) => s.playSong);

  // 相似歌曲：用歌手名搜索同歌手的其他歌曲（跨曲库推荐）
  useEffect(() => {
    if (!open || !song) return;
    let cancelled = false;
    const artist = song.artists?.[0]?.name;

    const t = setTimeout(() => {
      if (cancelled) return;
      if (!artist) {
        setSimilar([]);
        setLoadingSimilar(false);
        return;
      }
      setLoadingSimilar(true);
      setSimilar([]);
      searchSongs(artist, 1, 10)
        .then((r) => {
          if (cancelled) return;
          // 过滤掉当前这首歌（同名同歌手）
          setSimilar(
            r.songs
              .filter((s) => !(s.name === song.name && s.artists?.[0]?.name === artist))
              .slice(0, 6)
          );
        })
        .catch(() => {
          if (!cancelled) setSimilar([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingSimilar(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, song]);

  if (!song) return null;

  const items = [
    { label: "歌曲名称", value: song.name },
    { label: "歌手", value: song.artists?.map((a) => a.name).join(" / ") },
    { label: "专辑", value: song.album?.name },
    { label: "时长", value: formatDuration(song.duration) },
    { label: "歌曲ID", value: String(song.id) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 基础 DialogContent 自带 sm:max-w-sm（384px），需用 sm: 前缀才能拿到预期宽度 */}
      <DialogContent className="glass sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>歌曲信息</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 items-start">
          {getCoverUrl(song) ? (
            <img
              src={getCoverUrl(song) + "?param=200y200"}
              alt={song.name}
              className="w-24 h-24 rounded-lg object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-muted/30 shrink-0" />
          )}
          <div className="flex-1 space-y-3">
            {items.map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium text-right max-w-[200px] truncate">
                  {item.value || "--"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 相似歌曲推荐 */}
        <div className="border-t border-border/40 pt-3 mt-1">
          <p className="text-sm font-medium flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            相似歌曲
          </p>
          {loadingSimilar ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 bg-black/5" />
              ))}
            </div>
          ) : similar.length > 0 ? (
            <div className="space-y-0.5 max-h-52 overflow-y-auto">
              {similar.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 cursor-pointer group"
                  onClick={() => playSong(s, similar)}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); playSong(s, similar); }}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{s.name}</p>
                    <p className={cn("text-xs text-muted-foreground truncate")}>
                      {s.artists?.map((a) => a.name).join(" / ")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatDuration(s.duration)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">暂无相似歌曲推荐</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Ban, Trash2, Play, Loader2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import type { Song } from "@/lib/types";
import { cn, getCoverUrl } from "@/lib/utils";

function formatDuration(ms: number | undefined): string {
  if (typeof ms !== "number" || isNaN(ms) || ms < 0) return "--:--";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function BlacklistPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const { currentSong, isPlaying, isLoading, playSong, setQueue } = usePlayerStore();
  const { showToast } = useToast();

  useEffect(() => { loadData(); }, []);

  function loadData() {
    try {
      const blackIds: number[] = JSON.parse(localStorage.getItem("flowsound_blacklist") || "[]");
      const saved: Song[] = JSON.parse(localStorage.getItem("flowsound_blacklist_songs") || "[]");
      setSongs(saved.filter((s) => blackIds.includes(s.id)));
    } catch { setSongs([]); }
  }

  function removeOne(songId: number) {
    const blackIds: number[] = JSON.parse(localStorage.getItem("flowsound_blacklist") || "[]");
    localStorage.setItem("flowsound_blacklist", JSON.stringify(blackIds.filter((id) => id !== songId)));
    setSongs((prev) => prev.filter((s) => s.id !== songId));
    showToast("已从黑名单移除");
  }

  function clearAll() {
    localStorage.setItem("flowsound_blacklist", JSON.stringify([]));
    setSongs([]);
    showToast("黑名单已清空");
  }

  function handlePlay(song: Song, idx: number) {
    if (song.fee === 1) return;
    const playable = songs.filter((s) => s.fee !== 1);
    setQueue(playable);
    playSong(song, playable);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold"><span className="gradient-text">黑名单</span></h1>
          <p className="text-sm text-muted-foreground mt-1">被拉黑的歌曲不会出现在歌曲列表中</p>
        </div>
        {songs.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll} className="cursor-pointer">
            <Trash2 className="h-4 w-4 mr-1.5" />清空全部
          </Button>
        )}
      </div>

      {songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <Ban className="h-12 w-12 opacity-20" />
          <p className="text-sm">黑名单为空</p>
          <p className="text-xs opacity-50">在歌曲列表右键 → 加入黑名单</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* 表头 */}
          <div className="grid grid-cols-[3rem_2.5rem_1fr_1fr_5rem_3rem] gap-3 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider">
            <div className="text-center">#</div>
            <div />
            <div>歌曲</div>
            <div className="hidden sm:block">专辑</div>
            <div className="text-right">时长</div>
            <div />
          </div>

          {songs.map((song, index) => {
            const isCurrent = currentSong?.id === song.id;
            const isPaid = song.fee === 1;
            const coverUrl = getCoverUrl(song);

            return (
              <div
                key={song.id}
                className={cn(
                  "grid grid-cols-[3rem_2.5rem_1fr_1fr_5rem_3rem] gap-3 px-4 py-2 rounded-lg group items-center",
                  isCurrent && "bg-primary/10",
                  isPaid ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                )}
                onDoubleClick={() => handlePlay(song, index)}
              >
                {/* 序号 / 播放状态 */}
                <div className="flex items-center justify-center">
                  {isCurrent && isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : isCurrent && isPlaying ? (
                    <div className="flex items-end h-4 gap-[2px]">
                      <span className="eq-bar" style={{ height: "60%" }} />
                      <span className="eq-bar" style={{ height: "80%" }} />
                      <span className="eq-bar" style={{ height: "40%" }} />
                    </div>
                  ) : isPaid ? (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground group-hover:hidden">{index + 1}</span>
                      <Play
                        className="h-4 w-4 text-foreground hidden group-hover:block"
                        onClick={(e) => { e.stopPropagation(); handlePlay(song, index); }}
                      />
                    </>
                  )}
                </div>

                {/* 封面 */}
                <div className="w-10 h-10 rounded overflow-hidden shrink-0">
                  {coverUrl ? (
                    <img src={coverUrl + "?param=80y80"} alt={song.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Ban className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                {/* 歌名 + 歌手 */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn("text-sm truncate", isCurrent && "text-primary font-medium", isPaid && "text-muted-foreground")}>
                      {song.name}
                    </p>
                    {isPaid && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-amber-500/40 text-amber-500 shrink-0">VIP</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {song.artists?.map((a) => a.name).join(" / ")}
                  </p>
                </div>

                {/* 专辑 */}
                <div className="min-w-0 hidden sm:block">
                  <p className="text-sm text-muted-foreground truncate">{song.album?.name || "-"}</p>
                </div>

                {/* 时长 */}
                <div className="text-right">
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.duration)}</span>
                </div>

                {/* 移除按钮 */}
                <div className="flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); removeOne(song.id); }}
                    title="移出黑名单"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

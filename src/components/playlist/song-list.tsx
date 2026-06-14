"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Heart, Clock, Loader2, Lock, Plus, MoreHorizontal,
  ListPlus, Info, Share2, UserRound, Disc3, Ban, Download, MessageCircle
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlayerStore } from "@/lib/store";
import { SongInfoDialog } from "@/components/player/song-info";
import { ShareDialog } from "@/components/player/share-dialog";
import { CommentsDialog } from "@/components/player/comments-dialog";
import { downloadSong } from "@/lib/download";
import { useToast } from "@/components/ui/toast";
import type { Song } from "@/lib/types";
import { cn, getCoverUrl } from "@/lib/utils";

const ROW_HEIGHT = 56; // 每行固定高度

function formatDuration(ms: number | undefined): string {
  if (typeof ms !== "number" || isNaN(ms) || ms < 0) return "--:--";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface Playlist {
  id: string;
  name: string;
  songs: Song[];
}

interface SongListProps {
  songs: Song[];
  showIndex?: boolean;
  showAlbum?: boolean;
  /** 启用虚拟滚动（大列表推荐） */
  virtual?: boolean;
  /** 虚拟滚动容器最大高度，默认填充父容器 */
  maxHeight?: string;
}

function SongRow({
  song,
  index,
  isCurrent,
  isPlaying,
  isLoading,
  isPaid,
  isFav,
  showIndex,
  showAlbum,
  onPlay,
  onToggleFav,
  onMenu,
}: {
  song: Song;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  isPaid: boolean;
  isFav: boolean;
  showIndex: boolean;
  showAlbum: boolean;
  onPlay: () => void;
  onToggleFav: () => void;
  onMenu: () => void;
}) {
  const coverUrl = getCoverUrl(song);

  return (
    <div
      className={cn(
        "grid grid-cols-[3rem_2.5rem_1fr_1fr_5rem_2.5rem] gap-3 px-4 py-2 rounded-lg song-row group items-center",
        isCurrent && "bg-primary/10",
        isPaid ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      )}
      style={{ height: ROW_HEIGHT }}
      onDoubleClick={onPlay}
    >
      {/* 序号 */}
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
            <span className="text-sm text-muted-foreground group-hover:hidden">
              {showIndex ? index + 1 : ""}
            </span>
            <Play
              className="h-4 w-4 text-foreground hidden group-hover:block cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
            />
          </>
        )}
      </div>

      {/* 封面 */}
      <div className="w-10 h-10 rounded overflow-hidden shrink-0">
        {coverUrl ? (
          <img src={coverUrl + "?param=80y80"} alt={song.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center"><Play className="h-3 w-3 text-muted-foreground" /></div>
        )}
      </div>

      {/* 歌名 + 歌手 */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm truncate", isCurrent && "text-primary font-medium", isPaid && "text-muted-foreground")}>{song.name}</p>
          {isPaid && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/50 text-amber-500 shrink-0">VIP</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{song.artists?.map((a) => a.name).join(" / ")}</p>
      </div>

      {/* 专辑 */}
      {showAlbum && (
        <div className="min-w-0 hidden sm:block">
          <p className="text-sm text-muted-foreground truncate">{song.album?.name}</p>
        </div>
      )}

      {/* 时长 */}
      <div className="flex items-center justify-end gap-2">
        <Heart
          className={cn("h-3.5 w-3.5 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity", isFav && "fill-red-500 text-red-500 opacity-100")}
          onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        />
        <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.duration)}</span>
      </div>

      {/* 更多 */}
      <div className="flex items-center justify-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onMenu(); }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SongList({ songs, showIndex = true, showAlbum = true, virtual = false, maxHeight }: SongListProps) {
  const router = useRouter();
  const { currentSong, isPlaying, isLoading, playSong, toggleFavorite, isFavorite, setQueue } =
    usePlayerStore();
  const { showToast } = useToast();

  const [menuSong, setMenuSong] = useState<Song | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [infoSong, setInfoSong] = useState<Song | null>(null);
  const [shareSong, setShareSong] = useState<Song | null>(null);
  const [commentsSong, setCommentsSong] = useState<Song | null>(null);
  const [blacklist, setBlacklist] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("flowsound_blacklist") || "[]"); } catch { return []; }
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setPlaylists(JSON.parse(localStorage.getItem("flowsound_playlists") || "[]")); } catch { setPlaylists([]); }
  }, []);

  // 过滤黑名单
  const filteredSongs = songs.filter(s => !blacklist.includes(s.id));

  // 虚拟滚动
  const virtualizer = useVirtualizer({
    count: filteredSongs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: virtual,
  });

  const handlePlay = (song: Song) => {
    if (song.fee === 1) return;
    setQueue(songs);
    playSong(song, songs);
  };

  const addToPlaylist = (playlistId: string) => {
    if (!menuSong) return;
    const updated = playlists.map((p) => {
      if (p.id === playlistId && !p.songs.find((s) => s.id === menuSong.id)) {
        return { ...p, songs: [...p.songs, menuSong] };
      }
      return p;
    });
    localStorage.setItem("flowsound_playlists", JSON.stringify(updated));
    setPlaylists(updated);
    setShowAddToPlaylist(false);
    setMenuSong(null);
  };

  const addToBlacklist = (song: Song) => {
    const updated = [...blacklist, song.id];
    setBlacklist(updated);
    localStorage.setItem("flowsound_blacklist", JSON.stringify(updated));
    try {
      const saved: Song[] = JSON.parse(localStorage.getItem("flowsound_blacklist_songs") || "[]");
      if (!saved.find((s) => s.id === song.id)) {
        saved.push(song);
        localStorage.setItem("flowsound_blacklist_songs", JSON.stringify(saved));
      }
    } catch { /* ignore */ }
    setMenuSong(null);
    showToast("已加入黑名单");
  };

  const menuItems = [
    { icon: ListPlus, label: "添加到歌单", onClick: () => setShowAddToPlaylist(true) },
    {
      icon: Heart,
      label: menuSong && isFavorite(menuSong.id) ? "取消收藏" : "收藏",
      onClick: () => { if (menuSong) toggleFavorite(menuSong); setMenuSong(null); },
    },
    {
      icon: Download, label: "下载",
      onClick: async () => {
        if (!menuSong) return;
        try {
          const url = `/api/music?fn=song/url&id=${menuSong.id}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const songUrl = data.data?.[0]?.url;
          if (songUrl) {
            const name = `${menuSong.name} - ${menuSong.artists?.map((a) => a.name).join(", ")}.mp3`;
            await downloadSong(songUrl, name);
          } else {
            showToast("暂无可用音源", "warning");
          }
        } catch { showToast("下载失败，请稍后重试", "error"); }
        setMenuSong(null);
      },
    },
    { icon: MessageCircle, label: "查看评论", onClick: () => { setCommentsSong(menuSong); setMenuSong(null); } },
    { icon: Info, label: "歌曲信息", onClick: () => { setInfoSong(menuSong); setMenuSong(null); } },
    { icon: Share2, label: "分享", onClick: () => { setShareSong(menuSong); setMenuSong(null); } },
    {
      icon: UserRound, label: "查看歌手",
      disabled: !menuSong?.artists?.[0]?.id || menuSong.artists[0].id === 0,
      onClick: () => {
        if (menuSong?.artists?.[0]?.id && menuSong.artists[0].id !== 0) router.push(`/artist/${menuSong.artists[0].id}`);
        setMenuSong(null);
      },
    },
    {
      icon: Disc3, label: "查看专辑",
      disabled: !menuSong?.album?.id || menuSong.album.id === 0,
      onClick: () => {
        if (menuSong?.album?.id && menuSong.album.id !== 0) router.push(`/album/${menuSong.album.id}`);
        setMenuSong(null);
      },
    },
    { icon: Ban, label: "加入黑名单", onClick: () => { if (menuSong) addToBlacklist(menuSong); }, destructive: true },
  ];

  const renderRow = (song: Song, index: number) => (
    <SongRow
      key={song.id}
      song={song}
      index={index}
      isCurrent={currentSong?.id === song.id}
      isPlaying={isPlaying}
      isLoading={isLoading}
      isPaid={song.fee === 1}
      isFav={isFavorite(song.id)}
      showIndex={showIndex}
      showAlbum={showAlbum}
      onPlay={() => handlePlay(song)}
      onToggleFav={() => toggleFavorite(song)}
      onMenu={() => setMenuSong(song)}
    />
  );

  return (
    <>
      <div className="space-y-1">
        {/* 表头 */}
        <div className="grid grid-cols-[3rem_2.5rem_1fr_1fr_5rem_2.5rem] gap-3 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider">
          <div className="text-center">#</div>
          <div></div>
          <div>歌曲</div>
          <div className="hidden sm:block">专辑</div>
          <div className="text-right"><Clock className="h-3 w-3 inline" /></div>
          <div></div>
        </div>

        {/* 歌曲列表 */}
        {virtual ? (
          <div
            ref={scrollRef}
            className="overflow-y-auto"
            style={{ maxHeight: maxHeight || "calc(100vh - 320px)" }}
          >
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((vItem) => {
                const song = filteredSongs[vItem.index];
                return (
                  <div
                    key={song.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vItem.start}px)`,
                    }}
                  >
                    {renderRow(song, vItem.index)}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          filteredSongs.map((song, index) => renderRow(song, index))
        )}
      </div>

      {/* 操作菜单 */}
      <Dialog open={!!menuSong && !showAddToPlaylist} onOpenChange={() => setMenuSong(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>{menuSong?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">
            {menuSong?.artists?.map((a) => a.name).join(" / ")}
          </p>
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer",
                    "disabled" in item && item.disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50",
                    "destructive" in item && item.destructive && "text-destructive hover:bg-destructive/10"
                  )}
                  onClick={() => !("disabled" in item && item.disabled) && item.onClick()}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* 添加到歌单 */}
      <Dialog open={showAddToPlaylist} onOpenChange={() => { setShowAddToPlaylist(false); setMenuSong(null); }}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>添加到歌单</DialogTitle>
          </DialogHeader>
          {playlists.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {playlists.map((p) => {
                const alreadyIn = p.songs.some((s) => s.id === menuSong?.id);
                return (
                  <div
                    key={p.id}
                    className={cn("flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors", alreadyIn ? "bg-muted/50 opacity-50" : "hover:bg-muted/50")}
                    onClick={() => !alreadyIn && addToPlaylist(p.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                        <ListPlus className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.songs.length} 首</p>
                      </div>
                    </div>
                    {alreadyIn ? <span className="text-xs text-muted-foreground">已添加</span> : <Plus className="h-4 w-4 text-muted-foreground" />}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">还没有歌单，请先创建歌单</p>
          )}
        </DialogContent>
      </Dialog>

      <SongInfoDialog song={infoSong} open={!!infoSong} onOpenChange={() => setInfoSong(null)} />
      <ShareDialog song={shareSong} open={!!shareSong} onOpenChange={() => setShareSong(null)} />
      <CommentsDialog song={commentsSong} open={!!commentsSong} onOpenChange={() => setCommentsSong(null)} />
    </>
  );
}

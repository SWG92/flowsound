"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Disc3, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SongList } from "@/components/playlist/song-list";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { logError } from "@/lib/logger";
import type { Song } from "@/lib/types";

interface AlbumInfo {
  name: string;
  picUrl: string;
  description: string;
  artist: string;
  publishTime: number;
}

export default function AlbumPage() {
  const params = useParams();
  const id = params.id as string;
  const [album, setAlbum] = useState<AlbumInfo | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const { setQueue, playSong } = usePlayerStore();
  const { showToast } = useToast();

  useEffect(() => {
    if (!id || id === "0") {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const res = await fetch(`/api/music/album?id=${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAlbum({
          name: data.album?.name || "未知专辑",
          picUrl: data.album?.picUrl || "",
          description: data.album?.description || "",
          artist: data.album?.artist?.name || "",
          publishTime: data.album?.publishTime || 0,
        });
        setSongs(data.songs || []);
      } catch (error) {
        logError("Failed to load album info:", error);
        showToast("加载专辑信息失败", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, showToast]);

  if (!id || id === "0") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        该歌曲暂无专辑信息
      </div>
    );
  }

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    setQueue(songs);
    playSong(songs[0], songs);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-6">
          <Skeleton className="w-48 h-48 rounded-xl bg-black/5" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-40 bg-black/5" />
            <Skeleton className="h-4 w-60 bg-black/5" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 bg-black/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 专辑信息 */}
      <div className="flex items-start gap-6">
        <div className="w-48 h-48 rounded-xl overflow-hidden bg-muted shrink-0">
          {album?.picUrl ? (
            <img
              src={album.picUrl + "?param=400y400"}
              alt={album.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Disc3 className="h-20 w-20 text-muted-foreground" />
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold gradient-text">{album?.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{album?.artist}</p>
          {album?.publishTime && (
            <p className="text-xs text-muted-foreground mt-1">
              发行时间：
              {new Date(album.publishTime).toLocaleDateString("zh-CN")}
            </p>
          )}
          {album?.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
              {album.description}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayAll}
            className="mt-3 cursor-pointer"
          >
            <Play className="h-4 w-4 mr-1.5" />
            播放全部
          </Button>
        </div>
      </div>

      {/* 歌曲列表 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">歌曲列表</h2>
        <SongList songs={songs} showAlbum={false} virtual />
      </div>
    </div>
  );
}

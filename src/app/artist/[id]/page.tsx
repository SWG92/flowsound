"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { UserRound, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SongList } from "@/components/playlist/song-list";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { logError } from "@/lib/logger";
import type { Song } from "@/lib/types";

interface ArtistInfo {
  name: string;
  picUrl: string;
  briefDesc: string;
}

export default function ArtistPage() {
  const params = useParams();
  const id = params.id as string;
  const [artist, setArtist] = useState<ArtistInfo | null>(null);
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
        const res = await fetch(`/api/music/artist?id=${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setArtist({
          name: data.artist?.name || "未知歌手",
          picUrl: data.artist?.picUrl || "",
          briefDesc: data.artist?.briefDesc || "",
        });
        setSongs(data.hotSongs || []);
      } catch (error) {
        logError("Failed to load artist info:", error);
        showToast("加载歌手信息失败", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, showToast]);

  if (!id || id === "0") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        该歌曲暂无歌手信息
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
        <div className="flex items-center gap-4">
          <Skeleton className="w-32 h-32 rounded-full bg-black/5" />
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
      {/* 歌手信息 */}
      <div className="flex items-center gap-6">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-muted shrink-0">
          {artist?.picUrl ? (
            <img
              src={artist.picUrl + "?param=300y300"}
              alt={artist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <UserRound className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold gradient-text">{artist?.name}</h1>
          {artist?.briefDesc && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
              {artist.briefDesc}
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

      {/* 热门歌曲 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">热门歌曲</h2>
        <SongList songs={songs} />
      </div>
    </div>
  );
}

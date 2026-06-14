"use client";

import { useState, useEffect, useRef } from "react";
import { Music2 } from "lucide-react";
import { SongList } from "@/components/playlist/song-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { logError } from "@/lib/logger";
import type { Song } from "@/lib/types";

interface SimilarSongsProps {
  songId: number;
}

export function SimilarSongs({ songId }: SimilarSongsProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!songId) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    fetch(`/api/music/simi?type=song&id=${songId}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setSongs(data.songs || []);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        logError("Failed to load similar songs:", err);
        showToast("加载相似歌曲失败", "error");
      })
      .finally(() => setLoading(false));

    return () => {
      controller.abort();
    };
  }, [songId, showToast]);

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Music2 className="h-4 w-4" />
          相似歌曲
        </h3>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 bg-black/5" />
        ))}
      </div>
    );
  }

  if (songs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Music2 className="h-4 w-4" />
        相似歌曲
      </h3>
      <SongList songs={songs} />
    </div>
  );
}

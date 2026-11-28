"use client";

import { useState } from "react";
import { Disc3, Pause, Play, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/lib/store";
import { fetchPersonalFm } from "@/lib/api";
import { cn, getCoverUrl } from "@/lib/utils";

/**
 * 私人FM：网易云随机电台。
 * 匿名接口每次只回 1 首——并行拉 3 次合并去重成一小批入队，
 * 播放栏的上一首/下一首即可在批内切换；跳过=切下一首，批内到头自动补新批。
 */
export default function FmPage() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playSong = usePlayerStore((s) => s.playSong);
  const nextSong = usePlayerStore((s) => s.nextSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // 并行拉 3 次电台，合并去重成一批（匿名单次只回 1 首）
  const loadBatch = async (autoplay: boolean) => {
    setLoading(true);
    setFailed(false);
    try {
      const results = await Promise.all([fetchPersonalFm(), fetchPersonalFm(), fetchPersonalFm()]);
      const seen = new Set<number>();
      const merged = results.flat().filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      if (merged.length === 0) throw new Error("empty");
      const rest = merged.filter((s) => s.id !== currentSong?.id);
      const batch = rest.length > 0 ? rest : merged;
      setQueue(batch);
      if (autoplay) playSong(batch[0], batch, batch);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  // 跳过：批内有下一首就切；批内到头自动补新批接着放
  const handleSkip = () => {
    if (queueIndex < queue.length - 1) {
      const next = queue[queueIndex + 1];
      playSong(next, queue, queue);
    } else {
      loadBatch(true);
    }
  };

  // 电台面板跟随全局播放状态：切走再回来不会丢正在播的歌
  const song = currentSong;
  const cover = song ? getCoverUrl(song) : "";

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="gradient-text">私人FM</span>
          <Disc3 className="h-5 w-5 text-primary" />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">随机放歌 · 不喜欢就跳过</p>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        {song ? (
          <div className="flex flex-col items-center gap-6 w-full max-w-md">
            <div className="relative w-56 h-56 rounded-[28px] overflow-hidden shadow-2xl">
              {cover && <img src={cover + "?param=400y400"} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold truncate max-w-md">{song.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {song.artists?.map((a) => a.name).join(" / ")}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button size="sm" variant="outline" onClick={() => togglePlay()} className="cursor-pointer rounded-full px-4">
                {isPlaying ? "暂停" : "播放"}
              </Button>
              <Button size="sm" onClick={handleSkip} className="cursor-pointer rounded-full px-4" disabled={loading}>
                <SkipForward className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
                跳过
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 text-center">
            {loading ? (
              <Disc3 className="h-10 w-10 text-primary animate-spin" />
            ) : (
              <Disc3 className="h-14 w-14 text-primary/60" />
            )}
            <div>
              <p className="text-lg font-medium">{failed ? "FM 拉取失败" : loading ? "正在调频…" : "私人FM"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {failed ? "请稍后再试" : "随机放歌，不喜欢就跳过"}
              </p>
            </div>
            {!failed && !loading && (
              <Button onClick={() => loadBatch(true)} className="cursor-pointer">
                <Play className="h-4 w-4 mr-1.5" />
                开始收听
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

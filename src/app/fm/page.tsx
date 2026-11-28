"use client";

import { useState } from "react";
import { Disc3, HeartOff, Play, RefreshCw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { fetchPersonalFm } from "@/lib/api";
import { cn, getCoverUrl } from "@/lib/utils";

/**
 * 私人FM：网易云个性化电台（需登录）。
 * 取一批歌入队用全局播放器播放；跳过=下一首，换一批=重新拉取。
 * 播放由底部播放栏/全屏页接管，本页只做"电台面板"。
 */
export default function FmPage() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playSong = usePlayerStore((s) => s.playSong);
  const nextSong = usePlayerStore((s) => s.nextSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadBatch = async (autoplay: boolean) => {
    setLoading(true);
    setFailed(false);
    try {
      const songs = await fetchPersonalFm();
      if (songs.length === 0) throw new Error("empty");
      setQueue(songs);
      if (autoplay) playSong(songs[0], songs, songs);
      showToast(`FM 已换一批（${songs.length} 首）`, "info");
    } catch {
      setFailed(true);
      showToast("FM 拉取失败，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  };

  const firstLoad = () => loadBatch(true);

  // 跳过：队列里还有下一首就切；到队尾自动补一批接着放（之前队尾点击无反应）
  const handleSkip = () => {
    if (queueIndex < queue.length - 1) nextSong();
    else loadBatch(true);
  };

  // 电台面板跟随全局播放状态：切走再回来不会丢卡片（之前的局部 state 会在路由切换时清空）
  const song = currentSong;
  const cover = song ? getCoverUrl(song) : "";

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="gradient-text">私人FM</span>
          <Disc3 className="h-5 w-5 text-primary" />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          网易云个性化电台 · 播放由底部播放栏接管，切歌用下方按钮
        </p>
      </div>

      {/* 面板主体 */}
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
                {song.album?.name ? ` · ${song.album.name}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button size="sm" variant="outline" onClick={() => togglePlay()} className="cursor-pointer rounded-full px-4">
                {isPlaying ? "暂停" : "播放"}
              </Button>
              <Button size="sm" onClick={() => nextSong()} className="cursor-pointer rounded-full px-4" disabled={isLoading}>
                <SkipForward className="h-4 w-4 mr-1.5" />
                跳过
              </Button>
              <Button size="sm" variant="outline" onClick={() => loadBatch(true)} className="cursor-pointer rounded-full px-4" disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
                换一批
              </Button>
              <Button size="sm" variant="outline" onClick={() => showToast("已跳过，这类歌会越来越少推", "info")} className="cursor-pointer rounded-full px-4">
                <HeartOff className="h-4 w-4 mr-1.5" />
                不喜欢
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 text-center">
            {loading ? (
              <RefreshCw className="h-10 w-10 text-primary animate-spin" />
            ) : (
              <Disc3 className="h-14 w-14 text-primary/60" />
            )}
            <div>
              <p className="text-lg font-medium">
                {failed ? "FM 拉取失败" : loading ? "正在调频…" : "私人FM"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {failed
                  ? "请确认已在设置页登录网易云账号"
                  : "按你的口味随机放歌，不喜欢的就跳过"}
              </p>
            </div>
            {!failed && (
              <Button onClick={firstLoad} className="cursor-pointer" disabled={loading}>
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

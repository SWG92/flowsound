"use client";

import { useState } from "react";
import { Disc3, Pause, Play, SkipForward } from "lucide-react";
import { usePlayerStore } from "@/lib/store";
import { fetchPersonalFm } from "@/lib/api";
import { getCoverUrl } from "@/lib/utils";
import { useDominantColor } from "@/hooks/use-dominant-color";
import FlowCanvas from "@/components/player/flow-canvas";

/**
 * 私人FM：沉浸式电台页（参考 Mineradio 的粒子光影风格）。
 * 暗色面板 = 专辑封面高斯模糊 + 主色浸染 + 声浪流场画布（音频驱动的流动光影）；
 * 白字极简控制（暂停/跳过）。匿名接口单次只回 1 首——并行拉 3 次合并去重成一批，
 * 播放栏上一首/下一首即可在批内切换；跳过=切下一首，批内到头自动补新批。
 */

function hexAlpha(hex: string | null, alpha: number): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return "transparent";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function FmPage() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playSong = usePlayerStore((s) => s.playSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const song = currentSong;
  const cover = song ? getCoverUrl(song) : "";
  const accent = useDominantColor(cover || null);

  // 并行拉 3 次电台合并去重成一批（匿名单次只回 1 首）
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
      setQueue(merged);
      if (autoplay) playSong(merged[0], merged, merged);
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 沉浸区：与面板同材质（无独立暗色卡片，不与应用割裂）。
          专辑主色做成柔光晕染在封面后方，声浪流场低透明度融进背景 */}
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[760px] rounded-full transition-all duration-700"
            style={{ background: `radial-gradient(circle, ${hexAlpha(accent, 0.32)}, transparent 65%)` }}
          />
          {song && !loading && (
            <FlowCanvas
              accent={accent}
              className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
            />
          )}
        </div>

        {/* 左上角标识 */}
        <div className="absolute top-5 left-6 z-10">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">私人FM</p>
          <p className="text-xs text-muted-foreground/80 mt-0.5">随机放歌 · 不喜欢就跳过</p>
        </div>

        {/* 中央：封面 + 歌曲信息 + 极简控制 */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center gap-5 px-8">
          {song ? (
            <>
              <div
                className="w-52 h-52 rounded-[28px] overflow-hidden ring-1 ring-black/5 transition-all duration-700"
                style={{ boxShadow: `0 24px 80px ${hexAlpha(accent, 0.45)}` }}
              >
                {cover && <img src={cover + "?param=400y400"} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold truncate max-w-md">{song.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {song.artists?.map((a) => a.name).join(" / ")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => togglePlay()}
                  className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 bg-primary/15 hover:bg-primary/25 text-primary backdrop-blur"
                  title={isPlaying ? "暂停" : "播放"}
                >
                  {isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 ml-0.5" fill="currentColor" />}
                </button>
                <button
                  onClick={() => { if (!isLoading) handleSkip(); }}
                  className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 bg-primary text-primary-foreground hover:bg-primary/85 shadow-lg"
                  title="跳过"
                  disabled={isLoading}
                >
                  <SkipForward className="h-5 w-5" fill="currentColor" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-5 text-center">
              {loading ? (
                <Disc3 className="h-12 w-12 text-primary animate-spin" />
              ) : (
                <Disc3 className="h-14 w-14 text-primary/50" />
              )}
              <p className="text-lg font-medium">
                {failed ? "FM 拉取失败" : loading ? "正在调频…" : "私人FM"}
              </p>
              <p className="text-sm text-muted-foreground">
                {failed ? "请稍后再试" : "随机放歌，不喜欢就跳过"}
              </p>
              {!failed && !loading && (
                <button
                  onClick={() => loadBatch(true)}
                  className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm cursor-pointer transition-colors hover:bg-primary/90"
                >
                  开始收听
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

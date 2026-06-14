"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  ListMusic,
  Heart,
  Loader2,
  Timer,
  Gauge,
  SlidersHorizontal,
  MessageCircle,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlayerStore } from "@/lib/store";
import { useAudioPlayer } from "@/hooks/use-player";
import { audioPlayer } from "@/lib/audio-player";
import type { PlayMode } from "@/lib/types";
import { cn, getCoverUrl } from "@/lib/utils";
import { LyricsDisplay } from "./lyrics";
import { EQPanel } from "./equalizer-panel";
import { VisualizerBars } from "./visualizer-bars";
import { CommentsDialog } from "./comments-dialog";
import { useLyricsBroadcast } from "@/hooks/use-lyrics-broadcast";

const MODE_ICONS: Record<PlayMode, typeof Repeat> = {
  list: Repeat,
  single: Repeat1,
  shuffle: Shuffle,
};

const MODE_LABELS: Record<PlayMode, string> = {
  list: "列表循环",
  single: "单曲循环",
  shuffle: "随机播放",
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SLEEP_OPTIONS = [
  { label: "不关闭", value: 0 },
  { label: "15分钟", value: 15 },
  { label: "30分钟", value: 30 },
  { label: "45分钟", value: 45 },
  { label: "60分钟", value: 60 },
];

export function PlayerBar() {
  const { seek, formatTime } = useAudioPlayer();
  const [showLyrics, setShowLyrics] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [showSleep, setShowSleep] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  // 拖拽进度条时使用本地状态，隔离 rAF 循环的 currentTime 更新，防止抽搐
  const [dragTime, setDragTime] = useState<number | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const sleepRef = useRef<HTMLDivElement>(null);

  // 启用桌面悬浮歌词广播
  useLyricsBroadcast();

  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    playMode,
    speed,
    togglePlay,
    setVolume,
    setPlayMode,
    setSpeed,
    nextSong,
    prevSong,
    toggleFavorite,
    isFavorite,
    setShowQueue,
    showQueue,
    isLoading,
    setShowFloatingLyrics,
    showFloatingLyrics,
  } = usePlayerStore();

  const ModeIcon = MODE_ICONS[playMode];

  const cyclePlayMode = () => {
    const modes: PlayMode[] = ["list", "single", "shuffle"];
    const idx = modes.indexOf(playMode);
    setPlayMode(modes[(idx + 1) % modes.length]);
  };

  // 倍速控制 - 直接更新 store，useAudioPlayer 会自动同步到播放器
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    setShowSpeed(false);
  };

  // 定时关闭
  const handleSleep = (minutes: number) => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    setSleepMinutes(minutes);
    setShowSleep(false);
    if (minutes > 0) {
      sleepTimerRef.current = setTimeout(() => {
        usePlayerStore.getState().setPlaying(false);
        setSleepMinutes(0);
      }, minutes * 60 * 1000);
    }
  };

  // 静音切换
  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume);
    }
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) {
        setShowSpeed(false);
      }
      if (sleepRef.current && !sleepRef.current.contains(e.target as Node)) {
        setShowSleep(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, []);

  if (!currentSong && !isLoading) return null;

  const coverUrl = getCoverUrl(currentSong);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-20 glass z-50 flex items-center px-4 gap-4">
        {/* 歌曲信息 + 封面 */}
        <div className="flex items-center gap-3 w-64 shrink-0">
          <div
            className={cn(
              "w-12 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer",
              isPlaying && "playing-glow"
            )}
            onClick={() => setShowLyrics(true)}
          >
            {coverUrl ? (
              <img src={coverUrl + "?param=100y100"} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <ListMusic className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate cursor-pointer hover:underline" onClick={() => setShowLyrics(true)}>
              {currentSong?.name || "加载中..."}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentSong?.artists?.map((a) => a.name).join(" / ") || ""}
            </p>
          </div>

          <Button variant="ghost" size="icon" className="shrink-0 cursor-pointer h-8 w-8" onClick={() => currentSong && toggleFavorite(currentSong)}>
            <Heart className={cn("h-4 w-4", currentSong && isFavorite(currentSong.id) && "fill-red-500 text-red-500")} />
          </Button>
        </div>

        {/* 中间控制区 */}
        <div className="flex-1 flex flex-col items-center gap-1 max-w-2xl mx-auto">
          {/* 播放按钮行：居中 */}
          <div className="flex items-center justify-center gap-1 w-full">
            <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={cyclePlayMode} title={MODE_LABELS[playMode]}>
              <ModeIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={prevSong} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipBack className="h-4 w-4" />}
            </Button>
            <Button size="icon" className="rounded-full cursor-pointer w-9 h-9 mx-0.5" onClick={togglePlay} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={nextSong} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
            </Button>
            {/* 桌面悬浮歌词按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer h-8 w-8 text-xs font-bold"
              onClick={() => setShowFloatingLyrics(true)}
              title="打开桌面悬浮歌词"
              style={{
                background: showFloatingLyrics
                  ? "linear-gradient(135deg, rgba(74,144,217,0.2), rgba(53,122,189,0.15))"
                  : "transparent",
                borderRadius: 8,
              }}
            >
              <span className={showFloatingLyrics ? "text-sky-400" : "text-sky-500"}>词</span>
            </Button>
            {/* 可视化条右移 */}
            <div className="ml-1">
              <VisualizerBars barCount={8} maxHeight={20} />
            </div>
          </div>

          {/* 进度条行 */}
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
            <Slider
              value={[dragTime ?? currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={(val) => {
                const t = Array.isArray(val) ? val[0] : val;
                audioPlayer.setSeeking(true);
                setDragTime(t);
              }}
              onValueCommitted={() => {
                if (dragTime !== null) {
                  seek(dragTime);
                  setDragTime(null);
                }
                audioPlayer.setSeeking(false);
              }}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* 右侧：倍速 + 定时 + 队列 + 音量 */}
        <div className="flex items-center gap-2 shrink-0 justify-end w-64">
          {/* 倍速 - 下拉菜单 */}
          <div className="relative" ref={speedRef}>
            <Button
              variant="ghost"
              size="icon"
              className={cn("cursor-pointer h-8 w-8 relative", speed !== 1 && "text-primary")}
              onClick={() => { setShowSpeed(!showSpeed); setShowSleep(false); }}
              title="倍速播放"
            >
              <Gauge className="h-4 w-4" />
              {speed !== 1 && (
                <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded px-0.5">
                  {speed}x
                </span>
              )}
            </Button>
            {showSpeed && (
              <div className="absolute bottom-full right-0 mb-2 glass rounded-lg p-1 min-w-[80px] shadow-lg z-[60]">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    className={cn(
                      "w-full py-1.5 px-3 rounded text-sm transition-colors cursor-pointer text-center",
                      speed === s ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
                    )}
                    onClick={() => handleSpeedChange(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 均衡器 */}
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer h-8 w-8"
            onClick={() => setShowEQ(true)}
            title="均衡器"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          {/* 定时关闭 - 下拉菜单 */}
          <div className="relative" ref={sleepRef}>
            <Button
              variant="ghost"
              size="icon"
              className={cn("cursor-pointer h-8 w-8 relative", sleepMinutes > 0 && "text-primary")}
              onClick={() => { setShowSleep(!showSleep); setShowSpeed(false); }}
              title="定时关闭"
            >
              <Timer className="h-4 w-4" />
              {sleepMinutes > 0 && (
                <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded px-0.5">
                  {sleepMinutes}m
                </span>
              )}
            </Button>
            {showSleep && (
              <div className="absolute bottom-full right-0 mb-2 glass rounded-lg p-1 min-w-[100px] shadow-lg z-[60]">
                {SLEEP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      "w-full py-1.5 px-3 rounded text-sm transition-colors cursor-pointer text-left",
                      sleepMinutes === opt.value ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
                    )}
                    onClick={() => handleSleep(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 播放队列 */}
          <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={() => setShowQueue(!showQueue)} title="播放队列">
            <ListMusic className="h-4 w-4" />
          </Button>

          {/* 音量 */}
          <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={toggleMute} title={volume > 0 ? "静音" : "取消静音"}>
            {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={(val) => setVolume(Array.isArray(val) ? val[0] : val)}
            className="w-28"
          />
        </div>
      </div>

      {/* 歌词弹窗 */}
      <Dialog open={showLyrics} onOpenChange={setShowLyrics}>
        <DialogContent className="glass max-w-lg h-[70vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-center">{currentSong?.name || "歌词"}</DialogTitle>
            <p className="text-xs text-muted-foreground text-center">{currentSong?.artists?.map((a) => a.name).join(" / ")}</p>
            <div className="flex justify-center mt-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => { setShowLyrics(false); setShowComments(true); }}
                className="cursor-pointer text-xs"
              >
                <MessageCircle className="h-3 w-3 mr-1" />查看评论
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <LyricsDisplay />
          </div>
        </DialogContent>
      </Dialog>

      {/* 均衡器面板 */}
      <EQPanel open={showEQ} onClose={() => setShowEQ(false)} />

      {/* 评论弹窗 */}
      <CommentsDialog song={currentSong} open={showComments} onOpenChange={setShowComments} />
    </>
  );
}

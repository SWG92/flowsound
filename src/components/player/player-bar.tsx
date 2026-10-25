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
import { getSongUrlDetailed } from "@/lib/api";
import { AUDIO_QUALITY } from "@/lib/constants";
import type { AudioQuality } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
import { useAudioPlayer } from "@/hooks/use-player";
import { audioPlayer } from "@/lib/audio-player";
import type { PlayMode, MusicPlatform } from "@/lib/types";
import { cn, getCoverUrl } from "@/lib/utils";
import { LyricsDisplay } from "./lyrics";
import { EQPanel } from "./equalizer-panel";
import { VisualizerBars } from "./visualizer-bars";
import { CommentsDialog } from "./comments-dialog";
import { FullPlayer } from "./full-player";
import { ProgressBar } from "./progress";
import { PLAYER_DIALOG_SIZE } from "./dialog-sizes";
import { useLyricsBroadcast } from "@/hooks/use-lyrics-broadcast";
import { useMediaSession } from "@/hooks/use-media-session";

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
  { label: "播完当前歌", value: -1 },
  { label: "15分钟", value: 15 },
  { label: "30分钟", value: 30 },
  { label: "45分钟", value: 45 },
  { label: "60分钟", value: 60 },
];

// 播放栏按钮上的短标签（空间有限）
const QUALITY_SHORT_LABELS: Record<AudioQuality, string> = {
  smooth: "96K",
  standard: "128K",
  high: "320K",
  lossless: "无损",
};

const QUALITY_OPTIONS = (Object.entries(AUDIO_QUALITY) as [AudioQuality, { label: string; bitrate: string }][]).map(
  ([value, val]) => ({
    value,
    label: val.label,
    short: val.bitrate === "999000" ? "无损" : `${parseInt(val.bitrate) / 1000}K`,
  })
);

export function PlayerBar() {
  // useAudioPlayer 负责把 URL/音量/倍速同步到播放器（副作用在 hook 内），
  // 进度显示与 seek 已拆分到 <ProgressBar />（自订阅，高频更新不再重渲染本组件）
  useAudioPlayer();
  const [showLyrics, setShowLyrics] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [showSleep, setShowSleep] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFadingRef = useRef(false);
  const origVolumeRef = useRef<number>(0.8);
  const speedRef = useRef<HTMLDivElement>(null);
  const sleepRef = useRef<HTMLDivElement>(null);
  const qualityRef = useRef<HTMLDivElement>(null);

  // 启用桌面悬浮歌词广播
  useLyricsBroadcast();
  // 启用系统媒体控制（锁屏/通知中心）
  useMediaSession();

  // 字段级订阅：收藏/主题/队列数据等无关切片变化不再引发播放栏重渲染
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const playMode = usePlayerStore((s) => s.playMode);
  const speed = usePlayerStore((s) => s.speed);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setPlayMode = usePlayerStore((s) => s.setPlayMode);
  const setSpeed = usePlayerStore((s) => s.setSpeed);
  const nextSong = usePlayerStore((s) => s.nextSong);
  const prevSong = usePlayerStore((s) => s.prevSong);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  const setShowQueue = usePlayerStore((s) => s.setShowQueue);
  const showQueue = usePlayerStore((s) => s.showQueue);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const setShowFloatingLyrics = usePlayerStore((s) => s.setShowFloatingLyrics);
  const showFloatingLyrics = usePlayerStore((s) => s.showFloatingLyrics);
  const audioQuality = usePlayerStore((s) => s.audioQuality);
  const setAudioQuality = usePlayerStore((s) => s.setAudioQuality);
  const setShowFullPlayer = usePlayerStore((s) => s.setShowFullPlayer);
  // 收藏用派生布尔：只在"当前歌曲是否已收藏"翻转时重渲染
  const isCurrentFavorite = usePlayerStore((s) => (s.currentSong ? s.favorites.includes(s.currentSong.id) : false));

  const { showToast } = useToast();

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

  // 音质切换：写入设置后，若正在播放则按新音质重新加载当前歌曲（保留播放进度），
  // 否则用户会以为"切了没反应"（音质只影响新加载的地址）
  const handleQualityChange = async (quality: AudioQuality) => {
    setAudioQuality(quality);
    setShowQuality(false);
    const label = AUDIO_QUALITY[quality].label;

    const song = usePlayerStore.getState().currentSong;
    if (!song) {
      showToast(`已切换至${label}`);
      return;
    }
    const position = audioPlayer.getCurrentTime();
    const wasPlaying = usePlayerStore.getState().isPlaying;
    try {
      // 用带音质等级的版本：匿名账号请求无损时网易云会静默降级为 320k，
      // 拿到真实等级才能给用户明确提示
      const { url, level, levelLabel } = await getSongUrlDetailed(
        song.id,
        quality,
        (song.platform || "netease") as MusicPlatform,
        song.platformId
      );
      if (url) {
        // 暂停状态下切音质：加载后保持暂停，不突然开始播放
        audioPlayer.reloadAtPosition(url, position, !wasPlaying);
        if (quality === "lossless" && level && level !== "lossless" && level !== "hires") {
          showToast(`无损需会员，实际为${levelLabel || "320K"}，已按此播放`, "warning");
        } else {
          showToast(wasPlaying ? `已切换至${label}，正在重新加载` : `已切换至${label}`);
        }
      } else {
        showToast(`${label}暂不可用（可能需会员），已保留原音质`, "warning");
      }
    } catch {
      showToast("切换音质失败，请稍后重试", "error");
    }
  };

  // 定时关闭（带渐弱效果）
  // 注意：渐弱用 setInterval 而不是 requestAnimationFrame —— 后台标签页会暂停 rAF，
  // 导致定时关闭在挂后台时永远不触发（边听边切走恰恰是最主要的场景）
  const handleSleep = (minutes: number) => {
    // 清理之前的定时器和渐弱动画
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    // 只有渐弱已开始修改过音量时才需要恢复
    if (isFadingRef.current) {
      setVolume(origVolumeRef.current);
      isFadingRef.current = false;
    }
    // 分钟式定时与"播完当前歌"互斥：设其一即清另一
    usePlayerStore.getState().setSleepAtEndOfTrack(minutes === -1);

    setSleepMinutes(minutes);
    setShowSleep(false);

    if (minutes <= 0) return;

    const totalMs = minutes * 60 * 1000;
    const fadeDuration = Math.min(30000, totalMs * 0.15); // 渐弱时间：30秒 或 总时长的15%
    const fadeStartDelay = totalMs - fadeDuration;

    // 阶段1：等待到渐弱开始时间
    sleepTimerRef.current = setTimeout(() => {
      // 记录原始音量，渐弱从这里开始
      origVolumeRef.current = usePlayerStore.getState().volume;
      isFadingRef.current = true;
      const startVol = origVolumeRef.current;
      const fadeStart = Date.now();

      // 阶段2：渐弱（从当前音量到 0），setInterval 在后台标签页仍会触发
      fadeIntervalRef.current = setInterval(() => {
        const progress = Math.min((Date.now() - fadeStart) / fadeDuration, 1);
        setVolume(startVol * (1 - progress));

        if (progress >= 1) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
          isFadingRef.current = false;
          // 渐弱完成 → 暂停播放并恢复原始音量
          usePlayerStore.getState().setPlaying(false);
          setSleepMinutes(0);
          setVolume(origVolumeRef.current);
        }
      }, 250);
    }, fadeStartDelay);
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

  // 滚轮调音量（悬停在播放栏上滚动即可，向上加向下减）
  const handleWheelVolume = (e: React.WheelEvent) => {
    const current = usePlayerStore.getState().volume;
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const next = Math.min(1, Math.max(0, Math.round((current + delta) * 100) / 100));
    if (next !== current) {
      setVolume(next);
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
      if (qualityRef.current && !qualityRef.current.contains(e.target as Node)) {
        setShowQuality(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);

  if (!currentSong && !isLoading) return null;

  const coverUrl = getCoverUrl(currentSong);

  return (
    <>
      <div
        className="fixed left-2 right-2 md:left-3 md:right-3 h-16 md:h-20 glass rounded-[28px] z-50 flex items-center px-3 md:px-5 gap-2 md:gap-4"
        style={{ bottom: `calc(0.5rem + var(--safe-bottom))` }}
        onWheel={handleWheelVolume}
        title="滚轮可调节音量"
      >
        {/* 歌曲信息 + 封面 */}
        <div className="flex items-center gap-2 md:gap-3 w-28 md:w-64 shrink-0">
          <div
            className={cn(
              "w-12 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer",
              isPlaying && "playing-glow"
            )}
            onClick={() => setShowFullPlayer(true)}
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
            <p className="text-sm font-medium truncate cursor-pointer hover:underline" onClick={() => setShowFullPlayer(true)}>
              {currentSong?.name || "加载中..."}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentSong?.artists?.map((a) => a.name).join(" / ") || ""}
            </p>
          </div>

          <Button variant="ghost" size="icon" className="shrink-0 cursor-pointer h-8 w-8 hidden sm:inline-flex" onClick={() => currentSong && toggleFavorite(currentSong)}>
            <Heart className={cn("h-4 w-4", currentSong && isCurrentFavorite && "fill-red-500 text-red-500")} />
          </Button>
        </div>

        {/* 中间控制区 */}
        <div className="flex-1 flex flex-col items-center gap-1 max-w-2xl mx-auto">
          {/* 播放按钮行：居中 */}
          <div className="flex items-center justify-center gap-1 w-full">
            <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8 hidden sm:inline-flex" onClick={cyclePlayMode} title={MODE_LABELS[playMode]}>
              <ModeIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={() => prevSong()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipBack className="h-4 w-4" />}
            </Button>
            <Button size="icon" className="rounded-full cursor-pointer w-9 h-9 mx-0.5" onClick={togglePlay} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={() => nextSong()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
            </Button>
            {/* 桌面悬浮歌词按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer h-8 w-8 text-xs font-bold hidden sm:inline-flex"
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
            <div className="ml-1 hidden sm:block">
              <VisualizerBars barCount={8} maxHeight={20} />
            </div>
          </div>

          {/* 进度条行（自订阅组件：进度更新只重渲染进度条本身） */}
          <ProgressBar />
        </div>

        {/* 右侧：音质 + 倍速 + 定时 + 队列 + 音量 */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0 justify-end w-auto md:w-72">
          {/* 音质选择 - 下拉菜单 */}
          <div className="relative" ref={qualityRef}>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "cursor-pointer h-8 px-1.5 md:px-2 text-[11px] md:text-xs font-medium tabular-nums",
                audioQuality !== "high" && "text-primary"
              )}
              onClick={() => { setShowQuality(!showQuality); setShowSpeed(false); setShowSleep(false); }}
              title={`音质：${AUDIO_QUALITY[audioQuality].label}${currentSong ? "（切换后当前歌曲按新音质重新加载）" : ""}`}
            >
              {QUALITY_SHORT_LABELS[audioQuality]}
            </Button>
            {showQuality && (
              <div className="absolute bottom-full right-0 mb-2 glass rounded-lg p-1 min-w-[132px] shadow-lg z-[60]">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      "w-full py-1.5 px-3 rounded text-sm transition-colors cursor-pointer text-left flex items-center justify-between gap-2",
                      audioQuality === opt.value ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
                    )}
                    onClick={() => handleQualityChange(opt.value)}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[10px] opacity-70">{opt.short}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 倍速 - 下拉菜单 */}
          <div className="relative hidden md:block" ref={speedRef}>
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
            className="cursor-pointer h-8 w-8 hidden md:flex"
            onClick={() => setShowEQ(true)}
            title="均衡器"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          {/* 定时关闭 - 下拉菜单 */}
          <div className="relative hidden md:block" ref={sleepRef}>
            <Button
              variant="ghost"
              size="icon"
              className={cn("cursor-pointer h-8 w-8 relative", sleepMinutes !== 0 && "text-primary")}
              onClick={() => { setShowSleep(!showSleep); setShowSpeed(false); }}
              title="定时关闭"
            >
              <Timer className="h-4 w-4" />
              {sleepMinutes !== 0 && (
                <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded px-0.5">
                  {sleepMinutes === -1 ? "完" : `${sleepMinutes}m`}
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
          <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8 hidden md:flex" onClick={() => setShowQueue(!showQueue)} title="播放队列">
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
            className="hidden md:block w-28"
          />
        </div>
      </div>

      {/* 全屏播放页 */}
      <FullPlayer />

      {/* 歌词弹窗 */}
      <Dialog open={showLyrics} onOpenChange={setShowLyrics}>
        <DialogContent className={cn("glass flex flex-col p-0 overflow-hidden", PLAYER_DIALOG_SIZE)}>
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-center">{currentSong?.name || "歌词"}</DialogTitle>
            <p className="text-xs text-muted-foreground text-center">{currentSong?.artists?.map((a) => a.name).join(" / ")}</p>
            <div className="flex justify-center mt-2">
              <Button
                variant="outline"
                size="xs"
                // 不关闭歌词窗：评论窗叠在它上面，关闭评论后自然回到歌词（弹窗栈行为）
                onClick={() => setShowComments(true)}
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

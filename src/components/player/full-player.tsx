"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, Loader2, MessageCircle, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Shuffle } from "lucide-react";
import { usePlayerStore } from "@/lib/store";
import { audioPlayer } from "@/lib/audio-player";
import { cn, getCoverUrl } from "@/lib/utils";
import { ProgressFill } from "./progress";
import { CommentsDialog } from "./comments-dialog";
import { useDominantColor } from "@/hooks/use-dominant-color";
import type { PlayMode } from "@/lib/types";

/**
 * 全屏播放页（iOS 风格）：点播放栏封面/歌名展开。
 * 背景 = 当前封面高斯模糊放大；中部大封面与歌词；底部完整控制区。
 * 点击收起按钮或按 Esc 返回。
 */
export function FullPlayer() {
  const fullOpen = usePlayerStore((s) => s.showFullPlayer);
  const setFullOpen = usePlayerStore((s) => s.setShowFullPlayer);
  // 字段级订阅：收藏状态用派生布尔（只在收藏与否翻转时重渲染），
  // 音量/队列等其他切片变化不再引发全屏页重渲染；
  // 进度显示已拆到 <ProgressFill />（自订阅，250ms 更新不再重渲染本组件）
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const lyrics = usePlayerStore((s) => s.lyrics);
  const currentLyricIndex = usePlayerStore((s) => s.currentLyricIndex);
  const playMode = usePlayerStore((s) => s.playMode);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextSong = usePlayerStore((s) => s.nextSong);
  const prevSong = usePlayerStore((s) => s.prevSong);
  const setPlayMode = usePlayerStore((s) => s.setPlayMode);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);  const fav = usePlayerStore((s) => (s.currentSong ? s.favorites.includes(s.currentSong.id) : false));

  // 专辑主色（Material You 式动态取色）：浸染背景与控制元素，失败降级为原配色。
  // hook 必须在 early return 之前调用（React 规则）
  const accent = useDominantColor(fullOpen ? getCoverUrl(currentSong) : null);

  const [showLyricsView, setShowLyricsView] = useState(true);
  const [showComments, setShowComments] = useState(false);
  // 模式切换浮标：切换后短暂显示模式名（list/single 共用循环图标，需文字区分）
  const [modeTip, setModeTip] = useState(false);
  const modeTipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 下滑关闭手势（iOS 风格）
  const [dragY, setDragY] = useState(0);
  // 3 秒无操作隐藏控制区（沉浸歌词模式，触摸恢复）
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  // 3 秒无操作自动隐藏控制区；触摸/移动鼠标恢复，悬停在控制区上时保持显示
  const pokeControls = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  };
  // 悬停在控制区上时取消隐藏计时（移出后重新计时）
  const holdControls = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };
  useEffect(() => {
    if (!fullOpen) return;
    // 延后一拍启动计时器，避免同步 setState 告警
    const t = setTimeout(() => pokeControls(), 0);
    return () => {
      clearTimeout(t);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [fullOpen, currentSong?.id]);

  // Esc 收起；队列面板浮在本页上层时优先让队列响应（它关闭后再次 Esc 才收起本页）
  useEffect(() => {
    if (!fullOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !usePlayerStore.getState().showQueue) setFullOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullOpen, setFullOpen]);

  // 歌词自动滚动。不用 scrollIntoView(block:"center")：末尾几行后方内容不足时
  // 浏览器为满足"居中"会过度滚动（配合 smooth 动画表现为整块歌词向上喷出/抖动，
  // 即用户报告的"歌曲快结束页面自己上升"）。改为手动计算目标 scrollTop，
  // 边界自然钳制在 [0, scrollHeight - clientHeight]，末尾安静停住
  const scrollToLyric = (index: number, smooth = true) => {
    const container = containerRef.current;
    const el = container?.querySelector(`[data-lyric-index="${index}"]`);
    if (!container || !el) return;
    const rect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const target = container.scrollTop + (rect.top - cRect.top) - container.clientHeight / 2 + rect.height / 2;
    container.scrollTo({ top: target, behavior: smooth ? "smooth" : "instant" });
  };
  useEffect(() => {
    if (!fullOpen || !showLyricsView) return;
    if (!hasScrolled.current && currentLyricIndex >= 0) {
      scrollToLyric(currentLyricIndex);
      hasScrolled.current = true;
      return;
    }
    scrollToLyric(currentLyricIndex);
  }, [currentLyricIndex, fullOpen, showLyricsView]);
  useEffect(() => {
    hasScrolled.current = false;
  }, [fullOpen, currentSong?.id]);

  // 播放模式：三态图标（单曲循环用 Repeat1 与列表循环区分）+ 切换浮标提示
  const MODE_META: Record<PlayMode, { label: string; Icon: typeof Repeat }> = {
    list: { label: "列表循环", Icon: Repeat },
    single: { label: "单曲循环", Icon: Repeat1 },
    shuffle: { label: "随机播放", Icon: Shuffle },
  };
  const ModeIcon = MODE_META[playMode].Icon;

  const cyclePlayMode = () => {
    const modes: PlayMode[] = ["list", "single", "shuffle"];
    const next = modes[(modes.indexOf(playMode) + 1) % modes.length];
    setPlayMode(next);
    setModeTip(true);
    if (modeTipTimer.current) clearTimeout(modeTipTimer.current);
    modeTipTimer.current = setTimeout(() => setModeTip(false), 1200);
  };
  useEffect(() => {
    return () => {
      if (modeTipTimer.current) clearTimeout(modeTipTimer.current);
    };
  }, []);

  // 触摸手势：下滑关闭（iOS 风格）+ 左右滑切歌（网易云/QQ 音乐式）。
  // 轴向判定：首个显著位移方向锁定本次手势的轴，两手势互不干扰
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchAxisRef = useRef<"x" | "y" | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchAxisRef.current = null;
    pokeControls();
  };
  const onTouchMove = (e: React.TouchEvent) => {
    pokeControls();
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    if (!touchAxisRef.current) {
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy)) touchAxisRef.current = "x";
      else if (Math.abs(dy) > 14) touchAxisRef.current = "y";
    }
    if (touchAxisRef.current === "y" && dy > 0) setDragY(dy);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (touchAxisRef.current === "x" && start) {
      const dx = e.changedTouches[0].clientX - start.x;
      if (dx < -60) nextSong();
      else if (dx > 60) prevSong();
    } else if (dragY > 120) {
      setFullOpen(false);
    }
    setDragY(0);
    touchStartRef.current = null;
    touchAxisRef.current = null;
  };

  if (!fullOpen || !currentSong) return null;

  const cover = getCoverUrl(currentSong);
  const hexAlpha = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden flex flex-col animate-in fade-in-0 duration-300"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseMove={pokeControls}
      style={{
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transition: dragY ? "none" : "transform 0.3s ease",
        "--accent": accent ?? undefined,
        "--accent-soft": accent ? hexAlpha(accent, 0.28) : undefined,
      } as React.CSSProperties}>
      {/* 背景：封面高斯模糊放大 + 主色浸染遮罩 */}
      {cover && (
        <img
          src={cover + "?param=600y600"}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl"
        />
      )}
      <div className="absolute inset-0 bg-black/55" />
      {accent && <div className="absolute inset-0" style={{ background: "var(--accent-soft)" }} />}

      {/* 顶部：收起 + 标题（悬停时保持显示） */}
      <div
        className="relative z-10 flex items-center justify-between px-6 pt-6 transition-opacity duration-300"
        style={{ opacity: controlsVisible ? 1 : 0, pointerEvents: controlsVisible ? "auto" : "none", paddingTop: "calc(1.5rem + var(--safe-top))" }}
        onMouseEnter={holdControls}
        onMouseLeave={pokeControls}
      >
        <button
          onClick={() => setFullOpen(false)}
          className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
          title="收起"
        >
          <ChevronDown className="h-7 w-7" />
        </button>
        <div className="text-center min-w-0 max-w-[40%]">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">正在播放</p>
          {/* 显示歌名而非专辑名：专辑名与歌名无关时（如《晴天》显示"叶惠美"）容易被误认成歌名 */}
          <p className="text-sm text-white/90 truncate">{currentSong.name}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowComments(true)}
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="评论"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
          <button
            onClick={() => toggleFavorite(currentSong)}
            className={cn("p-2 rounded-full cursor-pointer transition-colors", fav ? "text-red-400" : "text-white/80 hover:text-white hover:bg-white/10")}
            title={fav ? "取消收藏" : "收藏"}
          >
            <Heart className={cn("h-6 w-6", fav && "fill-red-400")} />
          </button>
        </div>
      </div>

      {/* 中部：封面 / 歌词 */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 min-h-0">
        {showLyricsView ? (
          <div ref={containerRef} className="w-full max-w-xl flex-1 overflow-y-auto pt-12 pb-40 scrollbar-hide [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_78%,transparent_94%)]">
            {lyrics.length === 0 ? (
              <p className="text-center text-white/50 mt-16">暂无歌词</p>
            ) : (
              lyrics.map((line, i) => (
                <div
                  key={i}
                  data-lyric-index={i}
                  onClick={() => audioPlayer.seek(line.time)}
                  className={cn(
                    "text-center cursor-pointer select-none py-2 transition-all duration-300",
                    i === currentLyricIndex
                      ? "text-2xl font-semibold"
                      : "text-base text-white/45 hover:text-white/70"
                  )}
                  style={i === currentLyricIndex ? { color: accent ?? "#fff" } : undefined}
                >
                  {line.text}
                  {line.transText && (
                    <p className={cn("text-sm mt-0.5", i === currentLyricIndex ? "text-white/85" : "text-white/25")}>
                      {line.transText}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            <div
              className={cn(
                "w-64 h-64 md:w-80 md:h-80 rounded-[28px] overflow-hidden shadow-2xl",
                isPlaying && "shadow-primary/30"
              )}
            >
              {cover ? (
                <img src={cover + "?param=500y500"} alt={currentSong.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-6xl">🎵</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 歌名 + 歌手（与歌词区拉开距离） */}
      <div className="relative z-10 px-8 mt-4 pb-2 text-center">
        <h2 className="text-2xl font-bold text-white truncate">{currentSong.name}</h2>
        <p className="text-white/60 text-sm mt-1">
          {currentSong.artists?.map((a) => a.name).join(" / ")}
        </p>
      </div>

      {/* 底部控制区（悬停时保持显示） */}
      <div
        className="relative z-10 px-8 pt-2 max-w-xl mx-auto w-full transition-opacity duration-300"
        style={{ opacity: controlsVisible ? 1 : 0, pointerEvents: controlsVisible ? "auto" : "none", paddingBottom: "calc(2.5rem + var(--safe-bottom))" }}
        onMouseEnter={holdControls}
        onMouseLeave={pokeControls}
      >
        {/* 视图切换：封面 / 歌词 */}
        <div className="flex justify-center mb-3 gap-2">
          <button
            onClick={() => setShowLyricsView(false)}
            className={cn("px-3 py-1 rounded-full text-xs cursor-pointer transition-colors", !showLyricsView ? "bg-white/25 text-white" : "text-white/50 hover:text-white/80")}
          >
            封面
          </button>
          <button
            onClick={() => setShowLyricsView(true)}
            className={cn("px-3 py-1 rounded-full text-xs cursor-pointer transition-colors", showLyricsView ? "bg-white/25 text-white" : "text-white/50 hover:text-white/80")}
          >
            歌词
          </button>
        </div>

        {/* 进度条（自订阅组件） */}
        <ProgressFill />

        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-8 mt-5 relative">
          {/* 切换模式后浮出模式名称，消除"图标没变像卡住"的困惑
              （列表循环/单曲循环共用循环图标，需文字辅助区分） */}
          {/* 常驻渲染 + opacity 过渡：淡入淡出；底色用专辑主色柔光（与页面同色系，不用高对比黑）；
              纯提示不拦截点击 */}
          <span
            className={cn(
              "absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full backdrop-blur text-xs whitespace-nowrap border pointer-events-none transition-all duration-300",
              modeTip ? "opacity-100 -translate-y-1" : "opacity-0"
            )}
            style={{
              background: accent ? hexAlpha(accent, 0.4) : "rgba(255,255,255,0.12)",
              borderColor: accent ? hexAlpha(accent, 0.25) : "rgba(255,255,255,0.15)",
              color: "#fff",
            }}
          >
            {MODE_META[playMode].label}
          </span>
          <button
            onClick={cyclePlayMode}
            className={cn(
              "cursor-pointer transition-colors",
              playMode === "shuffle" ? "text-white" : "text-white/70 hover:text-white"
            )}
            title={MODE_META[playMode].label}
          >
            <ModeIcon className="h-5 w-5" />
          </button>
          <button onClick={() => prevSong()} className="text-white cursor-pointer transition-transform active:scale-90" title="上一首">
            <SkipBack className="h-8 w-8" fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-transform active:scale-90"
            style={{ background: accent ?? "#fff", color: "#111" }}
            title={isPlaying ? "暂停" : "播放"}
          >
            {isLoading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-7 w-7" fill="currentColor" />
            ) : (
              <Play className="h-7 w-7 ml-1" fill="currentColor" />
            )}
          </button>
          <button onClick={() => nextSong()} className="text-white cursor-pointer transition-transform active:scale-90" title="下一首">
            <SkipForward className="h-8 w-8" fill="currentColor" />
          </button>
        </div>
      </div>

      {/* 评论弹窗（层级高于全屏页） */}
      <CommentsDialog song={currentSong} open={showComments} onOpenChange={setShowComments} />
    </div>
  );
}

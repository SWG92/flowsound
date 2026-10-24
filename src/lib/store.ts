"use client";

import { create } from "zustand";
import type { Song, PlayMode, LyricLine, MusicPlatform } from "./types";
import { getSongUrl, getLyrics, prefetchSongUrl, searchSongs } from "./api";
import { STORAGE_KEYS, MAX_HISTORY, THEME_COOKIE } from "./constants";
import { useToastStore } from "./toast-store";
import type { AudioQuality } from "./constants";

interface PlayerState {
  // 当前播放
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  speed: number;

  // 播放队列
  queue: Song[];
  queueIndex: number;

  // 歌词
  lyrics: LyricLine[];
  currentLyricIndex: number;

  // 收藏（单一数据源）
  favorites: number[];      // 派生自 favoriteSongs
  favoriteSongs: Song[];
  playHistory: Song[];
  playCounts: Record<number, number>; // 听歌排行：歌曲ID → 播放次数

  // UI 状态
  showQueue: boolean;
  isLoading: boolean;
  showFloatingLyrics: boolean; // 悬浮歌词窗
  showFullPlayer: boolean; // 全屏播放页

  // 主题与设置
  theme: "light" | "dark";
  audioQuality: AudioQuality;
  autoContinueEnabled: boolean; // 队列播完后是否自动补歌续播（默认关闭：播完即停）

  // 操作
  playSong: (song: Song, queue?: Song[]) => Promise<void>;
  autoContinue: (song: Song) => Promise<void>;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setPlayMode: (mode: PlayMode) => void;
  setSpeed: (speed: number) => void;
  nextSong: (fromEnd?: boolean) => void;
  prevSong: () => void;
  setQueue: (songs: Song[]) => void;
  reorderQueue: (from: number, to: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playNext: (song: Song) => void;
  setCurrentLyricIndex: (index: number) => void;
  toggleFavorite: (song: Song) => void;
  isFavorite: (songId: number) => boolean;
  addToHistory: (song: Song) => void;
  clearHistory: () => void;
  setLyrics: (lyrics: LyricLine[]) => void;
  setShowQueue: (show: boolean) => void;
  setLoading: (loading: boolean) => void;
  setTheme: (theme: "light" | "dark") => void;
  setAudioQuality: (quality: AudioQuality) => void;
  setAutoContinueEnabled: (enabled: boolean) => void;
  setShowFloatingLyrics: (show: boolean) => void;
  setShowFullPlayer: (show: boolean) => void;
}

// localStorage 工具函数
function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** 写入主题 Cookie（服务端根布局据此渲染首屏主题类） */
export function writeThemeCookie(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // ignore
  }
}

// 初始化时加载数据
const initialFavoriteSongs = loadFromStorage<Song[]>(STORAGE_KEYS.favorites, []);
const initialHistory = loadFromStorage<Song[]>(STORAGE_KEYS.history, []);
const initialPlayCounts = loadFromStorage<Record<number, number>>(STORAGE_KEYS.playCounts, {});
const initialVolume = loadFromStorage<number>(STORAGE_KEYS.volume, 0.8);
const initialPlayMode = loadFromStorage<PlayMode>(STORAGE_KEYS.playMode, "list");
const initialSpeed = loadFromStorage<number>(STORAGE_KEYS.speed, 1);
const initialAudioQuality = loadFromStorage<AudioQuality>(STORAGE_KEYS.audioQuality, "high");
// 队列播完后自动补歌：默认关闭（播完即停，用户自己挑下一首），设置页可开启
const initialAutoContinue = loadFromStorage<boolean>(STORAGE_KEYS.autoContinue, false);

// 首屏主题以服务端渲染的 html class 为准（它来自 Cookie）：这样客户端首次渲染与
// 服务端完全一致，不会出现 hydration 不匹配；老用户（只有 localStorage、没有 Cookie）
// 由 ThemeProvider 在挂载后补写 Cookie 并同步主题。
function readInitialTheme(): "light" | "dark" {
  if (typeof document !== "undefined") {
    const cls = document.documentElement.classList;
    if (cls.contains("dark")) return "dark";
    if (cls.contains("light")) return "light";
  }
  return loadFromStorage<"light" | "dark">("flowsound_theme", "light");
}
const initialTheme = readInitialTheme();

// 从 favoriteSongs 派生 favorites ID 列表
const initialFavorites = initialFavoriteSongs.map((s) => s.id);

// 防止并发播放的 generation counter
let playGeneration = 0;
// 自动跳过无版权歌曲的计数器（防止死循环）
let autoSkipCount = 0;
// 智能补歌进行中标记（防止连点"下一首"触发多次补歌）
let autoContinueInFlight = false;

// ===== 真洗牌随机播放 =====
// 以歌曲 id 维护一个乱序序列：随机模式下按序列顺序播放，整轮不重复，
// 一轮播完自动重新洗牌。队列增删/手动切歌时序列自动同步。
let shuffleIds: number[] = [];
let shuffleCursor = 0;

function syncShuffleOrder(queue: Song[], currentId?: number) {
  const ids = queue.map((s) => s.id);
  if (ids.length === 0) {
    shuffleIds = [];
    return;
  }
  // 队列里已消失的 id 移除；新出现的 id 随机插入序列（Set 查找，千首队列下 O(n) 而非 O(n²)）
  const idSet = new Set(ids);
  shuffleIds = shuffleIds.filter((id) => idSet.has(id));
  const existing = new Set(shuffleIds);
  for (const id of ids) {
    if (!existing.has(id)) {
      shuffleIds.splice(Math.floor(Math.random() * (shuffleIds.length + 1)), 0, id);
      existing.add(id);
    }
  }
  // 游标对齐到正在播放的歌曲
  if (currentId !== undefined) {
    const pos = shuffleIds.indexOf(currentId);
    if (pos >= 0) shuffleCursor = pos;
  } else if (shuffleCursor >= shuffleIds.length) {
    shuffleCursor = 0;
  }
}

function nextShuffleIndex(queue: Song[], currentIndex: number): number {
  const currentId = queue[currentIndex]?.id;
  syncShuffleOrder(queue, currentId);
  if (shuffleIds.length <= 1) return currentIndex;
  // 一轮播完 → 重新洗牌开启新一轮
  if (shuffleCursor >= shuffleIds.length - 1) {
    for (let i = shuffleIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffleIds[i], shuffleIds[j]] = [shuffleIds[j], shuffleIds[i]];
    }
    // 避免新一轮第一首与刚播完的相同
    if (shuffleIds[0] === currentId) {
      const swapWith = 1 + Math.floor(Math.random() * (shuffleIds.length - 1));
      [shuffleIds[0], shuffleIds[swapWith]] = [shuffleIds[swapWith], shuffleIds[0]];
    }
    shuffleCursor = 0;
  } else {
    shuffleCursor++;
  }
  const idx = queue.findIndex((s) => s.id === shuffleIds[shuffleCursor]);
  return idx >= 0 ? idx : currentIndex;
}

function prevShuffleIndex(queue: Song[], currentIndex: number): number {
  const currentId = queue[currentIndex]?.id;
  syncShuffleOrder(queue, currentId);
  if (shuffleIds.length <= 1) return currentIndex;
  shuffleCursor = shuffleCursor > 0 ? shuffleCursor - 1 : shuffleIds.length - 1;
  const idx = queue.findIndex((s) => s.id === shuffleIds[shuffleCursor]);
  return idx >= 0 ? idx : currentIndex;
}

// 音量的 localStorage 写入做尾部合并：滑块拖动/滚轮/睡眠渐弱会以最高 4 次/秒
// 的频率调 setVolume，状态需要即时更新，但没必要每次都同步写存储
let volumeSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: initialVolume,
  playMode: initialPlayMode,
  speed: initialSpeed,
  queue: [],
  queueIndex: -1,
  lyrics: [],
  currentLyricIndex: -1,
  favorites: initialFavorites,
  favoriteSongs: initialFavoriteSongs,
  playHistory: initialHistory,
  playCounts: initialPlayCounts,
  showQueue: false,
  isLoading: false,
  showFloatingLyrics: false,
  showFullPlayer: false,
  theme: initialTheme,
  audioQuality: initialAudioQuality,
  autoContinueEnabled: initialAutoContinue,

  playSong: async (song, queue) => {
    const gen = ++playGeneration;
    set({ isLoading: true });

    const newQueue = queue || get().queue;
    const sourcePlatform = (song.platform || "netease") as MusicPlatform;
    const sourcePlatformId = song.platformId;

    // 多平台 URL 获取（源平台 → 其他平台依次回退）
    let url = "";
    let resolvedPlatform: MusicPlatform = sourcePlatform;
    let resolvedPlatformId = sourcePlatformId;

    try {
      url = await getSongUrl(song.id, undefined, sourcePlatform, sourcePlatformId);
    } catch { /* ignore */ }

    // 源平台无播放 URL → 在其他平台搜索同名歌曲
    if (!url) {
      const FALLBACK_ORDER: MusicPlatform[] = (
        ["netease", "qq", "kugou"] as MusicPlatform[]
      ).filter((p) => p !== sourcePlatform);

      const searchQuery = `${song.name} ${song.artists?.[0]?.name || ""}`.trim();

      for (const fbPlatform of FALLBACK_ORDER) {
        try {
          const result = await searchSongs(searchQuery, 1, 3, fbPlatform);
          if (result.songs.length > 0) {
            const match = result.songs[0];
            const fbUrl = await getSongUrl(
              match.id,
              undefined,
              fbPlatform,
              match.platformId
            );
            if (fbUrl) {
              url = fbUrl;
              resolvedPlatform = fbPlatform;
              resolvedPlatformId = match.platformId;
              break;
            }
          }
        } catch { /* continue to next platform */ }
      }
    }

    // 获取歌词
    let lyrics: LyricLine[] = [];
    try {
      lyrics = await getLyrics(song.id, resolvedPlatform, resolvedPlatformId);
    } catch { /* ignore */ }

    // 检查是否已被新请求取代
    if (gen !== playGeneration) return;

    if (!url) {
      // 所有平台均无播放 URL → 自动跳到下一首
      autoSkipCount++;
      if (autoSkipCount <= newQueue.length) {
        const currentIdx = newQueue.findIndex((s) => s.id === song.id);
        const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % newQueue.length : -1;
        if (nextIdx >= 0 && newQueue[nextIdx].id !== song.id) {
          get().playSong(newQueue[nextIdx], newQueue);
          return;
        }
      }
      autoSkipCount = 0;
      set({ isLoading: false });
      try {
        useToastStore.getState().showToast("当前歌曲在所有平台均不可播放", "error");
      } catch { /* toast store 可能未初始化 */ }
      return;
    }

    // 成功获取到 URL，重置自动跳过计数器
    autoSkipCount = 0;

    const songWithUrl = { ...song, url };
    const index = newQueue.findIndex((s) => s.id === song.id);

    set({
      currentSong: songWithUrl,
      isPlaying: true,
      currentTime: 0,
      queue: newQueue,
      queueIndex: index >= 0 ? index : 0,
      lyrics,
      currentLyricIndex: -1,
      isLoading: false,
    });

    // 洗牌游标对齐到刚播放的歌曲（手动点选/自动连播都保持序列一致）
    syncShuffleOrder(newQueue, song.id);

    // 预加载下一首
    const nextIdx = (index >= 0 ? index : 0) + 1;
    if (nextIdx < newQueue.length) {
      prefetchSongUrl(newQueue[nextIdx]);
    }

    // 添加到播放历史
    get().addToHistory(song);

    // 累计播放次数（听歌排行），只保留次数最高的 300 首控制存储体积
    const counts = { ...get().playCounts };
    counts[song.id] = (counts[song.id] || 0) + 1;
    const trimmed = Object.fromEntries(
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 300)
    );
    saveToStorage(STORAGE_KEYS.playCounts, trimmed);
    set({ playCounts: trimmed });
  },

  // 智能补歌：队列只剩当前一首（且非单曲循环）时，播完/切歌不再原地重播，
  // 按当前歌曲歌手名搜索其热门歌曲，挑一首队列里没有的接在队尾继续播放。
  // 补歌失败（无歌手信息/接口异常/没有新歌）回退为重播当前歌曲，与主流播放器行为一致。
  autoContinue: async (song) => {
    if (autoContinueInFlight) return;
    autoContinueInFlight = true;
    set({ isLoading: true });
    try {
      const artist = song.artists?.[0]?.name;
      let next: Song | undefined;
      if (artist) {
        const result = await searchSongs(artist, 1, 20, "netease");
        const known = new Set(get().queue.map((s) => s.id));
        known.add(song.id);
        next = result.songs.find((s) => !known.has(s.id) && s.name !== song.name);
      }
      if (!next) throw new Error("no candidate");
      const newQueue = [...get().queue, next];
      set({ queue: newQueue });
      await get().playSong(next, newQueue);
    } catch {
      const { queue, currentSong: cur } = get();
      if (cur) await get().playSong(cur, queue);
    } finally {
      autoContinueInFlight = false;
    }
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => {
    set({ volume });
    if (volumeSaveTimer) clearTimeout(volumeSaveTimer);
    volumeSaveTimer = setTimeout(() => {
      volumeSaveTimer = null;
      saveToStorage(STORAGE_KEYS.volume, volume);
    }, 500);
  },
  setPlayMode: (mode) => {
    saveToStorage(STORAGE_KEYS.playMode, mode);
    set({ playMode: mode });
  },
  setSpeed: (speed) => {
    saveToStorage(STORAGE_KEYS.speed, speed);
    set({ speed });
  },

  nextSong: (fromEnd = false) => {
    const { queue, queueIndex, playMode, currentSong, autoContinueEnabled } = get();
    if (queue.length === 0) return;

    // 单首队列且非单曲循环：
    // - 开启"自动补歌"→ 按歌手热门歌曲补一首继续播
    // - 关闭（默认）→ 自然播完即停止播放，等用户在外面挑歌；
    //   手动点下一首则重播当前歌（与主流播放器一致）
    if (queue.length <= 1 && playMode !== "single" && currentSong) {
      if (autoContinueEnabled) {
        get().autoContinue(currentSong);
        return;
      }
      if (fromEnd) {
        set({ isPlaying: false });
        return;
      }
      get().playSong(currentSong, queue);
      return;
    }

    let nextIndex: number;
    if (playMode === "shuffle") {
      // 真洗牌：按洗牌序列顺序播，整轮不重复；一轮播完重新洗牌开始新一轮
      nextIndex = nextShuffleIndex(queue, queueIndex);
    } else if (playMode === "single") {
      nextIndex = queueIndex;
    } else {
      nextIndex = (queueIndex + 1) % queue.length;
    }

    get().playSong(queue[nextIndex], queue);
  },

  prevSong: () => {
    const { queue, queueIndex, playMode, currentSong, autoContinueEnabled } = get();
    if (queue.length === 0) return;

    // 单首队列且非单曲循环：开启自动补歌则补一首，否则重播当前歌
    if (queue.length <= 1 && playMode !== "single" && currentSong) {
      if (autoContinueEnabled) {
        get().autoContinue(currentSong);
        return;
      }
      get().playSong(currentSong, queue);
      return;
    }

    if (playMode === "shuffle") {
      // 随机模式下"上一首"沿洗牌序列回退
      const prevIndex = prevShuffleIndex(queue, queueIndex);
      get().playSong(queue[prevIndex], queue);
      return;
    }
    const prevIndex = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1;
    get().playSong(queue[prevIndex], queue);
  },

  setQueue: (songs) => set({ queue: songs }),

  // 拖拽排序：重排后同步修正 queueIndex，使其继续指向正在播放的歌曲
  reorderQueue: (from, to) => {
    const { queue, queueIndex, currentSong } = get();
    if (from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
    const reordered = [...queue];
    const [moved] = reordered.splice(from, 1);
    if (!moved) return;
    reordered.splice(to, 0, moved);
    const newIdx = currentSong
      ? reordered.findIndex((s) => s.id === currentSong.id)
      : queueIndex;
    set({ queue: reordered, queueIndex: newIdx >= 0 ? newIdx : queueIndex });
  },

  // 从队列移除单曲（正在播放的不允许移除）
  removeFromQueue: (index) => {
    const { queue, queueIndex, currentSong } = get();
    if (index < 0 || index >= queue.length) return;
    if (currentSong && queue[index].id === currentSong.id) return;
    const newQueue = queue.filter((_, i) => i !== index);
    const newIdx = queueIndex > index ? queueIndex - 1 : queueIndex;
    set({ queue: newQueue, queueIndex: newIdx });
  },

  // 清空队列（保留正在播放的歌曲，保证 next/prev 不悬空）
  clearQueue: () => {
    const { currentSong } = get();
    set({ queue: currentSong ? [currentSong] : [], queueIndex: currentSong ? 0 : -1 });
  },

  // 下一首播放：把歌曲插到当前播放歌曲之后（若已在队列其他位置则先移除，避免重复）
  playNext: (song) => {
    const { queue, queueIndex, currentSong } = get();
    if (queue.length === 0 || queueIndex < 0 || !currentSong) {
      // 没有播放上下文：直接把队列设为这一首并从它开始播
      set({ queue: [song], queueIndex: 0 });
      get().playSong(song, [song]);
      return;
    }
    // 移除队列中已有的同一首（正在播放的那首除外）
    const filtered = queue.filter(
      (s, i) => !(s.id === song.id && i !== queueIndex)
    );
    // 插到当前歌曲之后（queueIndex 不变：插入点在其后）
    const insertAt = Math.min(queueIndex + 1, filtered.length);
    filtered.splice(insertAt, 0, song);
    set({ queue: filtered, queueIndex });
  },

  setCurrentLyricIndex: (index) => set({ currentLyricIndex: index }),
  setLyrics: (lyrics) => set({ lyrics }),

  toggleFavorite: (song: Song) => {
    const { favoriteSongs } = get();
    const isFav = favoriteSongs.some((s) => s.id === song.id);

    let newFavoriteSongs: Song[];
    if (isFav) {
      newFavoriteSongs = favoriteSongs.filter((s) => s.id !== song.id);
    } else {
      newFavoriteSongs = [...favoriteSongs, song];
    }

    const newFavorites = newFavoriteSongs.map((s) => s.id);
    saveToStorage(STORAGE_KEYS.favorites, newFavoriteSongs);
    set({ favorites: newFavorites, favoriteSongs: newFavoriteSongs });
  },

  isFavorite: (songId) => get().favorites.includes(songId),

  addToHistory: (song) => {
    const { playHistory } = get();
    const filtered = playHistory.filter((s) => s.id !== song.id);
    const newHistory = [song, ...filtered].slice(0, MAX_HISTORY);
    saveToStorage(STORAGE_KEYS.history, newHistory);
    set({ playHistory: newHistory });
  },

  clearHistory: () => {
    saveToStorage(STORAGE_KEYS.history, []);
    set({ playHistory: [] });
  },

  setShowQueue: (show) => set({ showQueue: show }),
  setLoading: (loading) => set({ isLoading: loading }),

  setTheme: (theme) => {
    saveToStorage("flowsound_theme", theme);
    // 同步写入 Cookie：根布局在服务端读取它并直接渲染出正确的 html class，
    // 这样首屏就是正确主题，不需要任何内联脚本（React 19 会警告组件内渲染 script）
    writeThemeCookie(theme);
    set({ theme });
  },

  setAudioQuality: (quality) => {
    saveToStorage(STORAGE_KEYS.audioQuality, quality);
    set({ audioQuality: quality });
  },

  setAutoContinueEnabled: (enabled) => {
    saveToStorage(STORAGE_KEYS.autoContinue, enabled);
    set({ autoContinueEnabled: enabled });
  },

  setShowFloatingLyrics: (show) => {
    set({ showFloatingLyrics: show });
  },

  setShowFullPlayer: (show) => {
    set({ showFullPlayer: show });
  },
}));

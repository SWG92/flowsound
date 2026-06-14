"use client";

import { create } from "zustand";
import type { Song, PlayMode, LyricLine, MusicPlatform } from "./types";
import { getSongUrl, getLyrics, prefetchSongUrl, searchSongs } from "./api";
import { STORAGE_KEYS, MAX_HISTORY } from "./constants";
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

  // UI 状态
  showQueue: boolean;
  isLoading: boolean;
  showFloatingLyrics: boolean; // 悬浮歌词窗

  // 主题与设置
  theme: "light" | "dark";
  audioQuality: AudioQuality;
  preferredPlatform: MusicPlatform; // 全局首选平台（影响首页/搜索/播放）

  // 操作
  playSong: (song: Song, queue?: Song[]) => Promise<void>;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setPlayMode: (mode: PlayMode) => void;
  setSpeed: (speed: number) => void;
  nextSong: () => void;
  prevSong: () => void;
  setQueue: (songs: Song[]) => void;
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
  setPreferredPlatform: (platform: MusicPlatform) => void;
  setShowFloatingLyrics: (show: boolean) => void;
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

// 初始化时加载数据
const initialFavoriteSongs = loadFromStorage<Song[]>(STORAGE_KEYS.favorites, []);
const initialHistory = loadFromStorage<Song[]>(STORAGE_KEYS.history, []);
const initialVolume = loadFromStorage<number>(STORAGE_KEYS.volume, 0.8);
const initialPlayMode = loadFromStorage<PlayMode>(STORAGE_KEYS.playMode, "list");
const initialSpeed = loadFromStorage<number>(STORAGE_KEYS.speed, 1);
const initialAudioQuality = loadFromStorage<AudioQuality>(STORAGE_KEYS.audioQuality, "high");
const initialTheme = loadFromStorage<"light" | "dark">("flowsound_theme", "light");

// 从 favoriteSongs 派生 favorites ID 列表
const initialFavorites = initialFavoriteSongs.map((s) => s.id);

// 防止并发播放的 generation counter
let playGeneration = 0;
// 自动跳过无版权歌曲的计数器（防止死循环）
let autoSkipCount = 0;

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
  showQueue: false,
  isLoading: false,
  showFloatingLyrics: false,
  theme: initialTheme,
  audioQuality: initialAudioQuality,
  preferredPlatform: "netease",

  playSong: async (song, queue) => {
    const gen = ++playGeneration;
    set({ isLoading: true });

    const newQueue = queue || get().queue;
    const sourcePlatform = (song.platform || "netease") as MusicPlatform;
    const sourcePlatformId = song.platformId;

    // 多平台 URL 获取（源平台 → 其他平台依次回退）
    let url = "";
    let resolvedPlatform: MusicPlatform = sourcePlatform;

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
              break;
            }
          }
        } catch { /* continue to next platform */ }
      }
    }

    // 获取歌词
    let lyrics: LyricLine[] = [];
    try {
      lyrics = await getLyrics(song.id, resolvedPlatform, sourcePlatformId);
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

    // 预加载下一首
    const nextIdx = (index >= 0 ? index : 0) + 1;
    if (nextIdx < newQueue.length) {
      prefetchSongUrl(newQueue[nextIdx].id);
    }

    // 添加到播放历史
    get().addToHistory(song);
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => {
    saveToStorage(STORAGE_KEYS.volume, volume);
    set({ volume });
  },
  setPlayMode: (mode) => {
    saveToStorage(STORAGE_KEYS.playMode, mode);
    set({ playMode: mode });
  },
  setSpeed: (speed) => {
    saveToStorage(STORAGE_KEYS.speed, speed);
    set({ speed });
  },

  nextSong: () => {
    const { queue, queueIndex, playMode } = get();
    if (queue.length === 0) return;

    let nextIndex: number;
    if (playMode === "shuffle") {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (playMode === "single") {
      nextIndex = queueIndex;
    } else {
      nextIndex = (queueIndex + 1) % queue.length;
    }

    get().playSong(queue[nextIndex], queue);
  },

  prevSong: () => {
    const { queue, queueIndex } = get();
    if (queue.length === 0) return;

    const prevIndex = queueIndex <= 0 ? queue.length - 1 : queueIndex - 1;
    get().playSong(queue[prevIndex], queue);
  },

  setQueue: (songs) => set({ queue: songs }),

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
    set({ theme });
  },

  setAudioQuality: (quality) => {
    saveToStorage(STORAGE_KEYS.audioQuality, quality);
    set({ audioQuality: quality });
  },

  setPreferredPlatform: (platform) => {
    set({ preferredPlatform: platform });
  },

  setShowFloatingLyrics: (show) => {
    set({ showFloatingLyrics: show });
  },
}));

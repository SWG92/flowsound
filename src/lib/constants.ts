// API 基础 URL
export const NETEASE_BASE = "https://music.163.com";

// API 端点
export const NETEASE_API = {
  search: `${NETEASE_BASE}/api/search/get/web`,
  songUrl: `${NETEASE_BASE}/api/song/enhance/player/url`,
  lyric: `${NETEASE_BASE}/api/song/lyric`,
  playlistDetail: `${NETEASE_BASE}/api/playlist/detail`,
  album: `${NETEASE_BASE}/api/album`,
  artist: `${NETEASE_BASE}/api/artist`,
  loginCellphone: `${NETEASE_BASE}/api/login/cellphone`,
  anonymousLogin: `${NETEASE_BASE}/api/register/anonimous`,
  comments: (id: string) =>
    `${NETEASE_BASE}/api/v1/resource/comments/R_SO_4_${id}`,
  simiSong: `${NETEASE_BASE}/api/discovery/simiSong`,
  simiArtist: `${NETEASE_BASE}/api/discovery/simiArtist`,
} as const;

// 请求头
export const NETEASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Referer: "https://music.163.com/",
  "Content-Type": "application/x-www-form-urlencoded",
} as const;

// 超时时间 (ms)
export const FETCH_TIMEOUT = 10000;
export const CLIENT_FETCH_TIMEOUT = 15000;

// 缓存 TTL (ms)
export const CACHE_TTL = 5 * 60 * 1000;

// 默认歌单 ID
export const DEFAULT_PLAYLIST_IDS = {
  hot: "3778678",
  rising: "19723756",
  new: "3779629",
} as const;

// 每日推荐歌单来源
export const RECOMMEND_PLAYLISTS = [
  "3778678",
  "19723756",
  "3779629",
  "2884035",
  "3776523",
] as const;

// 音频质量对应的 bitrate
export const AUDIO_QUALITY = {
  smooth: { label: "流畅", bitrate: "96000" },
  standard: { label: "标准", bitrate: "128000" },
  high: { label: "高品质", bitrate: "320000" },
  lossless: { label: "无损", bitrate: "999000" },
} as const;

export type AudioQuality = keyof typeof AUDIO_QUALITY;

// 播放倍速
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

// 定时关闭
export const SLEEP_TIMER_OPTIONS = [
  { label: "15 分钟", value: 15 },
  { label: "30 分钟", value: 30 },
  { label: "45 分钟", value: 45 },
  { label: "60 分钟", value: 60 },
] as const;

// localStorage 键前缀
export const STORAGE_KEYS = {
  favorites: "flowsound_favorite_songs",
  history: "flowsound_history",
  volume: "flowsound_volume",
  playMode: "flowsound_play_mode",
  speed: "flowsound_speed",
  theme: "flowsound_theme",
  audioQuality: "flowsound_audio_quality",
  searchHistory: "flowsound_search_history",
  eqSettings: "flowsound_eq_settings",
  dailyRecommend: "flowsound_daily_recommend",
  playlists: "flowsound_playlists",
} as const;

// Toast 持续时间 (ms)
export const TOAST_DURATION = 4000;

// 历史记录上限
export const MAX_HISTORY = 100;
export const MAX_SEARCH_HISTORY = 20;

// 应用信息
export const APP_INFO = {
  name: "FlowSound",
  version: "1.0.0",
  tech: "Next.js 16 + React 19 + TypeScript + Tailwind CSS 4",
} as const;

// 分享链接
export const SHARE_LINK = (id: number) =>
  `https://music.163.com/song?id=${id}`;

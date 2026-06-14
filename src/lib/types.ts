// 歌曲信息
export interface Song {
  id: number;
  name: string;
  artists: Artist[];
  album: Album;
  duration: number; // 毫秒
  fee?: number;     // 0=免费, 1=付费/VIP
  url?: string;     // 播放地址（需单独获取）
  platform?: MusicPlatform; // 来源平台
  platformId?: string; // 平台原生 ID（QQ音乐 songmid、酷狗 hash 等）
}

/** 支持的音乐平台 */
export type MusicPlatform = "netease" | "qq" | "kugou";

// 歌手
export interface Artist {
  id: number;
  name: string;
  img1v1Url?: string;
  picUrl?: string;
}

// 专辑
export interface Album {
  id: number;
  name: string;
  picUrl: string;
}

// 歌词行
export interface LyricLine {
  time: number;     // 秒
  text: string;     // 原文
  transText?: string; // 翻译（如有）
}

// 搜索结果
export interface SearchResult {
  songs: Song[];
  total: number;
  hasMore: boolean;
}

// 排行榜
export interface TopList {
  id: number;
  name: string;
  description: string;
  coverImgUrl: string;
  songs: Song[];
}

// 播放模式
export type PlayMode = "list" | "single" | "shuffle";

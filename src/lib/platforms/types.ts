// 音乐平台抽象层类型定义

import type { Song, SearchResult, LyricLine, MusicPlatform } from "@/lib/types";

/** 平台信息 */
export interface PlatformInfo {
  id: MusicPlatform;
  name: string;
  color: string;     // 主题色（Tailwind CSS 类名）
  icon: string;       // emoji 图标
  enabled: boolean;
}

/** 所有平台的元数据 */
export const PLATFORMS: Record<MusicPlatform, PlatformInfo> = {
  netease: {
    id: "netease",
    name: "网易云",
    color: "bg-red-500",
    icon: "☁️",
    enabled: true,
  },
  qq: {
    id: "qq",
    name: "QQ音乐",
    color: "bg-emerald-500",
    icon: "🎵",
    enabled: true,
  },
  kugou: {
    id: "kugou",
    name: "酷狗",
    color: "bg-blue-500",
    icon: "🎤",
    enabled: true,
  },
};

/** 平台适配器 —— 每个平台实现此接口 */
export interface PlatformAdapter {
  /** 搜索歌曲 */
  search(
    keywords: string,
    page: number,
    limit: number
  ): Promise<SearchResult>;

  /** 获取歌曲播放 URL */
  getSongUrl(songId: string): Promise<string>;

  /** 获取歌词 */
  getLyrics(songId: string): Promise<LyricLine[]>;

  /** 获取歌单详情（返回歌曲列表） */
  getPlaylistDetail(listId: string): Promise<Song[]>;
}

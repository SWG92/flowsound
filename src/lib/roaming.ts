"use client";

import { searchSongs } from "./api";
import type { Song } from "./types";

/**
 * 音乐漫游：流派 → 精选歌单曲池。
 * 每个流派人工筛选 2 个高口碑歌单（网易云），曲池 = 两歌单合并去重洗牌。
 * 播放交给现有队列机制（playSong(pool[0], pool, pool)），队列尾部自动绕回，
 * 天然无限漫游；刷新后由播放快照恢复队列与来源列表，漫游不中断。
 */

export interface RoamingGenre {
  id: string;
  label: string;
  desc: string;
  /** 酷狗流派关键词（补一路搜索源，单词——酷狗多词搜索返回空） */
  kw: string;
  playlists: number[];
}

export const ROAMING_GENRES: RoamingGenre[] = [
  {
    id: "cn-pop",
    label: "华语流行",
    kw: "华语流行",
    desc: "华语圈热门精选，流行与国风兼收",
    playlists: [8661866203, 12892248640],
  },
  {
    id: "rock",
    label: "摇滚",
    kw: "摇滚",
    desc: "从 Beyond 到 OneRepublic 的 Guitar 墙",
    playlists: [8186425024, 8668604238],
  },
  {
    id: "folk",
    label: "民谣",
    kw: "民谣",
    desc: "人文主义的吟唱，故事都在歌里",
    playlists: [6666506290, 8756917202],
  },
  {
    id: "electronic",
    label: "电子",
    kw: "电子舞曲",
    desc: "低频律动，Deep House 到 Bass",
    playlists: [17916709370, 17490348385],
  },
  {
    id: "jazz",
    label: "爵士",
    kw: "爵士",
    desc: "名盘试音碟，藏在爵士里的温柔情话",
    playlists: [8447786200, 17690654376],
  },
  {
    id: "light",
    label: "轻音乐",
    kw: "轻音乐",
    desc: "治愈系纯音乐，让暖意漫过心头",
    playlists: [12509832645, 17715323368],
  },
  {
    id: "focus",
    label: "学习专注",
    kw: "学习",
    desc: "自习室伴侣，静心不扰",
    playlists: [8207429796, 5451934030],
  },
  {
    id: "workout",
    label: "运动节奏",
    kw: "运动",
    desc: "步频 150，跟着节奏跑起来",
    playlists: [8822626201, 8549083204],
  },
  {
    id: "sleep",
    label: "睡前舒缓",
    kw: "睡眠",
    desc: "夜色轻拥，助你入眠",
    playlists: [6671216522, 5449543141],
  },
];

export const ROAMING_POOL_LIMIT = 40;

/** Fisher-Yates 洗牌（返回新数组，不动原数组） */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 按「歌名|歌手」合并去重（跨歌单重复曲目只保留一次），洗牌后截取池上限 */
function mergeDedupe(pools: Song[][]): Song[] {
  const seen = new Set<string>();
  const merged: Song[] = [];
  for (const pool of pools) {
    for (const s of pool) {
      const key = `${s.name}|${(s.artists || [])
        .map((a) => a.name.trim())
        .filter(Boolean)
        .sort()
        .join("/")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }
  }
  return merged;
}

/** 构建漫游曲池：并行拉取流派歌单 → 合并去重 → 洗牌取上限 */
export async function buildRoamingPool(genre: RoamingGenre): Promise<Song[]> {
  // 三路曲源并行：网易云歌单 ×2 + 酷狗流派关键词搜索
  const results = await Promise.allSettled([
    ...genre.playlists.map(
      (id) =>
        fetch(`/api/music?fn=playlist/detail&id=${id}`).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<{
            playlist?: { tracks: Song[] };
            result?: { tracks: Song[] };
          }>;
        }).then((d) => d.playlist?.tracks || d.result?.tracks || []),
    ),
    searchSongs(genre.kw, 1, 12, "kugou").then((r) => r.songs),
  ]);
  const pools = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  if (pools.every((p) => p.length === 0)) {
    throw new Error("漫游曲池拉取失败");
  }
  return shuffle(mergeDedupe(pools)).slice(0, ROAMING_POOL_LIMIT);
}

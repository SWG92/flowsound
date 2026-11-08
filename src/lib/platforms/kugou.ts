// 酷狗音乐平台适配器

import type { PlatformAdapter } from "./types";
import type { Song, LyricLine } from "@/lib/types";
import { FETCH_TIMEOUT } from "@/lib/constants";

const KG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://m.kugou.com/",
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: KG_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) {
    throw new Error(`KuGou API error: ${res.status}`);
  }
  return res.json();
}

// 从 hash 生成稳定的数字 ID
function songIdFromHash(hash: string): number {
  let num = 0;
  for (let i = 0; i < Math.min(hash.length, 8); i++) {
    num = (num << 4) + parseInt(hash[i], 16);
  }
  return Math.abs(num) % 2147483647;
}

export const kugouAdapter: PlatformAdapter = {
  async search(keywords, page, limit) {
    try {
      const data = await fetchJSON<{
        data: {
          info: Array<{
            hash: string;
            songname: string;
            singername: string;
            album_name: string;
            duration: number;
            album_id?: string;
          }>;
          total: number;
        };
      }>(
        `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(keywords)}&page=${page}&pagesize=${limit}&showtype=1`
      );

      const list = data.data?.info || [];
      const songs: Song[] = list.map((item) => ({
        id: songIdFromHash(item.hash),
        name: item.songname,
        artists: [{ id: 0, name: item.singername }],
        album: {
          id: 0,
          name: item.album_name || "",
          picUrl: item.album_id
            ? `https://imge.kugou.com/stdmusic/${item.album_id}.png`
            : "",
        },
        duration: item.duration * 1000,
        platform: "kugou",
        platformId: item.hash,
      }));

      return {
        songs,
        total: data.data?.total || 0,
        hasMore: page * limit < (data.data?.total || 0),
      };
    } catch {
      return { songs: [], total: 0, hasMore: false };
    }
  },

  async getSongUrl(platformId) {
    if (!platformId) return "";

    try {
      const data = await fetchJSON<{
        url?: string;
        bitRate?: number;
        status?: number;
      }>(
        `http://m.kugou.com/app/i/getSongInfo.php?hash=${platformId}&cmd=playInfo`
      );

      return data.url || "";
    } catch {
      return "";
    }
  },

  async getLyrics(platformId) {
    if (!platformId) return [];

    try {
      // 酷狗 KRC 接口返回的是纯文本歌词（KRC 逐字时间轴或标准 LRC），不是 JSON——
      // 必须按 text 读取；此前用 res.json() 解析必然抛错，酷狗歌词因此一直是空的
      const res = await fetch(
        `http://m.kugou.com/app/i/krc.php?hash=${platformId}&cmd=100&timelength=999999`,
        { headers: KG_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) }
      );
      if (!res.ok) return [];

      const raw = (await res.text()).trim();
      // 空响应或 HTML 错误页都视为无歌词
      if (!raw || raw.startsWith("<")) return [];

      return parseKugouLyric(raw);
    } catch {
      return [];
    }
  },

  async getPlaylistDetail(_listId) {
    return [];
  },
};

// 酷狗 KRC 歌词解析（简化版 KRC → 类 LRC 格式提取）
function parseKugouLyric(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];

  // KRC 格式: [id:$...] ... [<startTime>,<duration>]<text>
  // 简单提取 [数字,数字] 行
  const krcLineRe = /\[(\d+),\d+\](.*)/g;
  let match: RegExpExecArray | null;

  while ((match = krcLineRe.exec(raw)) !== null) {
    const startMs = parseInt(match[1]);
    const text = match[2].trim();
    if (text && text !== "//") {
      lines.push({
        time: startMs / 1000,
        text,
      });
    }
  }

  // 如果 KRC 解析失败，尝试普通 LRC 解析
  if (lines.length === 0) {
    const lrcLineRe = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
    while ((match = lrcLineRe.exec(raw)) !== null) {
      const time =
        parseInt(match[1]) * 60 +
        parseInt(match[2]) +
        parseInt(match[3]) / (match[3].length === 3 ? 1000 : 100);
      const text = match[4].trim();
      if (text) {
        lines.push({ time, text });
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

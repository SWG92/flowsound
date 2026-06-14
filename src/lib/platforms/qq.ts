// QQ 音乐平台适配器

import type { PlatformAdapter } from "./types";
import type { Song, LyricLine } from "@/lib/types";
import { FETCH_TIMEOUT } from "@/lib/constants";

const QQ_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://y.qq.com/",
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: QQ_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) {
    throw new Error(`QQ Music API error: ${res.status}`);
  }
  return res.json();
}

function makeGuid(): string {
  const chars = "0123456789abcdef";
  let guid = "";
  for (let i = 0; i < 32; i++) {
    guid += chars[Math.floor(Math.random() * chars.length)];
  }
  return guid.toUpperCase();
}

// 从 songmid 生成稳定的数字 ID（用作 Song.id，保证同首歌 ID 不变）
function songIdFromMid(mid: string): number {
  let hash = 0;
  for (let i = 0; i < mid.length; i++) {
    hash = ((hash << 5) - hash + mid.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// 获取 vkey（播放凭证）
async function getVkey(songmid: string): Promise<string> {
  try {
    const reqData = JSON.stringify({
      req_0: {
        module: "vkey.GetVkeyServer",
        method: "CgiGetVkey",
        param: {
          guid: makeGuid(),
          songmid: [songmid],
          songtype: [0],
          uin: "0",
          loginflag: 1,
          platform: "20",
        },
      },
    });

    const data = await fetchJSON<{
      req_0: {
        code: number;
        data: {
          midurlinfo: Array<{ purl: string }>;
          sip: string[];
        };
      };
    }>(`https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(reqData)}`);

    const info = data.req_0?.data?.midurlinfo?.[0];
    const sip = data.req_0?.data?.sip || [];
    if (info?.purl && sip.length > 0) {
      return sip[0] + info.purl;
    }
  } catch {
    // ignore
  }
  return "";
}

export const qqAdapter: PlatformAdapter = {
  async search(keywords, page, limit) {
    try {
      const data = await fetchJSON<{
        code?: number;
        data?: {
          song?: {
            list?: Array<{
              songmid?: string;
              songname?: string;
              singer?: Array<{ name: string; id?: number; mid?: string }>;
              albumname?: string;
              albummid?: string;
              interval?: number;
              pay?: { payplay?: number };
            }>;
            totalnum?: number;
          };
        };
      }>(
        `https://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp?format=json&p=${page}&n=${limit}&w=${encodeURIComponent(keywords)}`
      );

      const list = data?.data?.song?.list;
      if (!Array.isArray(list) || list.length === 0) {
        return { songs: [], total: data?.data?.song?.totalnum || 0, hasMore: false };
      }

      const songs: Song[] = list.map((item) => ({
        id: songIdFromMid(item.songmid || ""),
        name: item.songname || "未知歌曲",
        artists: (item.singer || []).map((s) => ({ id: s.id || 0, name: s.name || "未知歌手" })),
        album: {
          id: 0,
          name: item.albumname || "",
          picUrl: item.albummid
            ? `https://y.qq.com/music/photo_new/T002R300x300M000${item.albummid}.jpg`
            : "",
        },
        duration: (item.interval || 0) * 1000,
        fee: item.pay?.payplay ?? 0,
        platform: "qq" as const,
        platformId: item.songmid || "",
      }));

      return {
        songs,
        total: data?.data?.song?.totalnum || 0,
        hasMore: page * limit < (data?.data?.song?.totalnum || 0),
      };
    } catch {
      return { songs: [], total: 0, hasMore: false };
    }
  },

  async getSongUrl(platformId) {
    if (!platformId || platformId === "0") return "";
    return getVkey(platformId);
  },

  async getLyrics(platformId) {
    if (!platformId || platformId === "0") return [];

    try {
      const data = await fetchJSON<{
        lyric?: string;
        trans?: string;
      }>(
        `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${platformId}&format=json&g_tk=5381`
      );

      const lrc = data.lyric || "";
      const trans = data.trans || "";
      return parseQQLyric(
        Buffer.from(lrc, "base64").toString("utf-8"),
        Buffer.from(trans, "base64").toString("utf-8")
      );
    } catch {
      return [];
    }
  },

  async getPlaylistDetail(_listId) {
    return [];
  },
};

// QQ 音乐歌词格式：[mm:ss.xx]lyric
function parseQQLyric(lrc: string, transLrc?: string): LyricLine[] {
  // 解析翻译
  const transMap = new Map<number, string>();
  if (transLrc) {
    for (const line of transLrc.split("\n")) {
      const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (m) {
        const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
        const text = m[4].trim();
        if (text) transMap.set(time, text);
      }
    }
  }

  const lines: LyricLine[] = [];
  for (const line of lrc.split("\n")) {
    const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (m) {
      const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
      const text = m[4].trim();
      if (text) {
        let transText: string | undefined;
        for (const [tTime, tText] of transMap) {
          if (Math.abs(tTime - time) < 0.5) {
            transText = tText;
            break;
          }
        }
        lines.push({ time, text, transText });
      }
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

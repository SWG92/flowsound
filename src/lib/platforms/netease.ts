// 网易云音乐平台适配器

import type { PlatformAdapter } from "./types";
import type { Song, SearchResult, LyricLine } from "@/lib/types";
import { NETEASE_API, NETEASE_HEADERS, FETCH_TIMEOUT } from "@/lib/constants";

let neteaseCookie = "";

export function setNeteaseCookie(cookie: string) {
  neteaseCookie = cookie;
}

export function getNeteaseCookie(): string {
  return neteaseCookie;
}

// 游客登录
async function ensureLogin(): Promise<string> {
  if (neteaseCookie) return neteaseCookie;

  try {
    const res = await fetch("https://music.163.com/api/register/anonimous", {
      method: "POST",
      headers: NETEASE_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await res.json();
    if (data.code === 200 && data.cookie) {
      neteaseCookie = data.cookie;
      return data.cookie;
    }
  } catch {
    // ignore
  }
  return "";
}

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...NETEASE_HEADERS,
      ...(neteaseCookie ? { Cookie: neteaseCookie } : {}),
      ...(options.headers || {}),
    },
    signal: options.signal || AbortSignal.timeout(FETCH_TIMEOUT),
  });
  return res.json();
}

export const neteaseAdapter: PlatformAdapter = {
  async search(keywords, page, limit) {
    const offset = (page - 1) * limit;
    const data = await fetchJSON<{
      result: { songs: Song[]; songCount: number };
    }>(NETEASE_API.search, {
      method: "POST",
      body: new URLSearchParams({
        s: keywords,
        type: "1",
        offset: String(offset),
        limit: String(limit),
      }),
    });

    const songs = (data.result?.songs || []).map((s: Song) => ({
      ...s,
      platform: "netease" as const,
      platformId: String(s.id),
    }));
    // 补充专辑封面
    const missingCovers = songs
      .filter((s) => !s.album?.picUrl && s.album?.id)
      .slice(0, 10);

    if (missingCovers.length > 0) {
      await Promise.all(
        missingCovers.map(async (s) => {
          try {
            const albumData = await fetchJSON<{
              album: { picUrl: string };
            }>(`https://music.163.com/api/album/${s.album.id}`);
            if (albumData.album?.picUrl) {
              s.album.picUrl = albumData.album.picUrl;
            }
          } catch {
            // ignore
          }
        })
      );
    }

    return {
      songs,
      total: data.result?.songCount || 0,
      hasMore: page * limit < (data.result?.songCount || 0),
    };
  },

  async getSongUrl(songId) {
    await ensureLogin();

    const data = await fetchJSON<{
      data: { url: string }[];
    }>(`${NETEASE_API.songUrl}?ids=[${songId}]&br=320000`);

    return data.data?.[0]?.url || "";
  },

  async getLyrics(songId) {
    const data = await fetchJSON<{
      lrc?: { lyric: string };
      tlyric?: { lyric: string };
    }>(`${NETEASE_API.lyric}?lv=1&tv=-1&id=${songId}`);

    const lrc = data.lrc?.lyric || "";
    const tLrc = data.tlyric?.lyric || "";
    return parseLRC(lrc, tLrc);
  },

  async getPlaylistDetail(listId) {
    await ensureLogin();
    const data = await fetchJSON<{
      result?: { tracks: Song[] };
      playlist?: { tracks: Song[] };
    }>(`${NETEASE_API.playlistDetail}?id=${listId}`);

    return data.result?.tracks || data.playlist?.tracks || [];
  },
};

function parseLRC(lrc: string, tlyric?: string): LyricLine[] {
  const transMap = new Map<number, string>();
  if (tlyric) {
    for (const line of tlyric.split("\n")) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const ms = parseInt(match[3]);
        const time =
          minutes * 60 + seconds + ms / (match[3].length === 3 ? 1000 : 100);
        const text = match[4].trim();
        if (text) transMap.set(time, text);
      }
    }
  }

  const result: LyricLine[] = [];
  for (const line of lrc.split("\n")) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const time =
        minutes * 60 + seconds + ms / (match[3].length === 3 ? 1000 : 100);
      const text = match[4].trim();
      if (text) {
        let transText: string | undefined;
        for (const [tTime, tText] of transMap) {
          if (Math.abs(tTime - time) < 0.5) {
            transText = tText;
            break;
          }
        }
        result.push({ time, text, transText });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

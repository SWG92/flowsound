import type { Song, SearchResult, LyricLine, MusicPlatform } from "./types";
import { CLIENT_FETCH_TIMEOUT, CACHE_TTL, STORAGE_KEYS, DEFAULT_PLAYLIST_IDS, AUDIO_QUALITY } from "./constants";
import type { AudioQuality } from "./constants";

// 简单内存缓存
const cache = new Map<string, { data: unknown; time: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, time: Date.now() });
}

async function fetchJSON<T>(
  fn: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL("/api/music", window.location.origin);
  url.searchParams.set("fn", fn);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(CLIENT_FETCH_TIMEOUT),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ============ 搜索 ============

export async function searchSongs(
  keywords: string,
  page = 1,
  limit = 30,
  platform: MusicPlatform = "netease"
): Promise<SearchResult> {
  const cacheKey = `search:${platform}:${keywords}:${page}:${limit}`;
  const cached = getCached<SearchResult>(cacheKey);
  if (cached) return cached;

  const offset = (page - 1) * limit;
  const data = await fetchJSON<SearchResult>("search", {
    keywords,
    offset: String(offset),
    limit: String(limit),
    platform,
  });

  setCache(cacheKey, data);
  return data;
}

// ============ 全平台聚合搜索 ============

export async function searchAllPlatforms(
  keywords: string,
  page = 1,
  limit = 30
): Promise<SearchResult> {
  const cacheKey = `search:all:${keywords}:${page}:${limit}`;
  const cached = getCached<SearchResult>(cacheKey);
  if (cached) return cached;

  const platforms: MusicPlatform[] = ["netease", "qq", "kugou"];
  const perPlatform = Math.ceil(limit / platforms.length);

  const results = await Promise.allSettled(
    platforms.map((p) => searchSongs(keywords, page, perPlatform, p))
  );

  // 合并去重（同名 + 同歌手视为重复）
  const seen = new Set<string>();
  const merged: Song[] = [];

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const song of r.value.songs) {
      const key = `${song.name}|${song.artists?.[0]?.name || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(song);
      }
    }
  }

  const result: SearchResult = {
    songs: merged.slice(0, limit),
    total: merged.length,
    hasMore: merged.length >= limit,
  };

  setCache(cacheKey, result);
  return result;
}

// ============ 歌曲播放 URL ============

export async function getSongUrl(
  id: number | string,
  quality?: AudioQuality,
  platform: MusicPlatform = "netease",
  platformId?: string
): Promise<string> {
  const q = quality || getStoredQuality();
  const bitrate = AUDIO_QUALITY[q].bitrate;
  const pid = platformId || String(id);

  const cacheKey = `url:${platform}:${pid}:${bitrate}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  // 对于非网易云平台，发送 platformId
  const params: Record<string, string> = {
    id: platform !== "netease" ? pid : String(id),
    br: bitrate,
    platform,
  };
  if (platformId) params.platformId = platformId;

  const data = await fetchJSON<{ data?: Array<{ url: string }>; url?: string }>(
    "song/url",
    params
  );

  // 兼容新旧格式
  let url = "";
  if (data.data && Array.isArray(data.data)) {
    url = data.data[0]?.url || "";
  } else if (typeof data.url === "string") {
    url = data.url;
  }

  if (url) setCache(cacheKey, url);
  return url;
}

// ============ 歌词 ============

export async function getLyrics(
  id: number | string,
  platform: MusicPlatform = "netease",
  platformId?: string
): Promise<LyricLine[]> {
  const pid = platformId || String(id);
  const cacheKey = `lyric:${platform}:${pid}`;
  const cached = getCached<LyricLine[]>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string> = {
    id: platform !== "netease" ? pid : String(id),
    platform,
  };
  if (platformId) params.platformId = platformId;

  // 新接口直接返回 LyricLine[]，旧接口返回 { lrc, tlyric }
  const data = await fetchJSON<LyricLine[] | {
    lrc: { lyric: string };
    tlyric?: { lyric: string };
  }>("lyric", params);

  if (Array.isArray(data)) {
    setCache(cacheKey, data);
    return data;
  }

  // 兼容旧的网易云格式（parseLRC 逻辑内联）
  const lrc = data.lrc?.lyric || "";
  const tLrc = data.tlyric?.lyric || "";
  const result = parseLRC(lrc, tLrc);
  setCache(cacheKey, result);
  return result;
}

function parseLRC(lrc: string, tlyric?: string): LyricLine[] {
  const transMap = new Map<number, string>();
  if (tlyric) {
    for (const line of tlyric.split("\n")) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const ms = parseInt(match[3]);
        const time = minutes * 60 + seconds + ms / (match[3].length === 3 ? 1000 : 100);
        const text = match[4].trim();
        if (text) transMap.set(time, text);
      }
    }
  }

  const lines = lrc.split("\n");
  const result: LyricLine[] = [];
  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const time = minutes * 60 + seconds + ms / (match[3].length === 3 ? 1000 : 100);
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

// ============ 存储 ============

function getStoredQuality(): AudioQuality {
  if (typeof window === "undefined") return "high";
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.audioQuality);
    if (stored && stored in AUDIO_QUALITY) return stored as AudioQuality;
  } catch {
    // ignore
  }
  return "high";
}

// ============ 热门/歌单（始终用网易云） ============

export async function getHotSongs(): Promise<Song[]> {
  const cacheKey = "netease:hot";
  const cached = getCached<Song[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJSON<{
    result?: { tracks: Song[] };
    playlist?: { tracks: Song[] };
  }>("playlist/detail", { id: DEFAULT_PLAYLIST_IDS.hot, platform: "netease" });
  const tracks = data.result?.tracks || data.playlist?.tracks || [];
  const result = tracks.slice(0, 50).map((s: Song) => ({ ...s, platform: "netease" as const, platformId: String(s.id) }));
  setCache(cacheKey, result);
  return result;
}

export async function getRisingSongs(): Promise<Song[]> {
  const cacheKey = "netease:rising";
  const cached = getCached<Song[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJSON<{
    result?: { tracks: Song[] };
    playlist?: { tracks: Song[] };
  }>("playlist/detail", { id: DEFAULT_PLAYLIST_IDS.rising, platform: "netease" });
  const tracks = data.result?.tracks || data.playlist?.tracks || [];
  const result = tracks.slice(0, 50).map((s: Song) => ({ ...s, platform: "netease" as const, platformId: String(s.id) }));
  setCache(cacheKey, result);
  return result;
}

export async function getNewSongs(): Promise<Song[]> {
  const cacheKey = "netease:new";
  const cached = getCached<Song[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJSON<{
    result?: { tracks: Song[] };
    playlist?: { tracks: Song[] };
  }>("playlist/detail", { id: DEFAULT_PLAYLIST_IDS.new, platform: "netease" });
  const tracks = data.result?.tracks || data.playlist?.tracks || [];
  const result = tracks.slice(0, 50).map((s: Song) => ({ ...s, platform: "netease" as const, platformId: String(s.id) }));
  setCache(cacheKey, result);
  return result;
}

// 预加载
export function prefetchSongUrl(_id: number) {
  // 简化：通过 getSongUrl 预加载（内部已有缓存）
  getSongUrl(_id).catch(() => {});
}

// 相似歌曲
export async function getSimilarSongs(id: number): Promise<Song[]> {
  const data = await fetchJSON<{ songs: Song[] }>("simi/song", {
    id: String(id),
  });
  return data.songs || [];
}

// 相似歌手
export async function getSimilarArtists(
  id: number
): Promise<{ id: number; name: string; picUrl: string }[]> {
  const data = await fetchJSON<{
    artists: { id: number; name: string; picUrl: string }[];
  }>("simi/artist", { id: String(id) });
  return data.artists || [];
}

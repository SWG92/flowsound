import type { Song, SearchResult, LyricLine, MusicPlatform } from "./types";
import { CLIENT_FETCH_TIMEOUT, CACHE_TTL, STORAGE_KEYS, DEFAULT_PLAYLIST_IDS, AUDIO_QUALITY } from "./constants";
import type { AudioQuality } from "./constants";

// 简单内存缓存
const cache = new Map<string, { data: unknown; time: number }>();
// 容量上限：长时间使用（大量搜索/点播）时不至于无限增长
const MAX_CACHE_ENTRIES = 200;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // 淘汰最早插入的条目（Map 迭代按插入序）
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data, time: Date.now() });
}

/** 清空内存中的接口缓存（搜索结果、歌曲地址、歌词等）。供设置页"清除缓存"调用。 */
export function clearApiCache() {
  cache.clear();
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
    // 绕过浏览器 HTTP 缓存：本层已有内存缓存（Map），HTTP 缓存属重复；
    // 且响应结构升级时（如新增字段）旧缓存会让客户端 30 分钟拿不到新结构
    cache: "no-store",
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
  let totalCount = 0; // 各平台报告的总量（去重前，作近似展示值）
  let anyHasMore = false;

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    totalCount += r.value.total || 0;
    if (r.value.hasMore) anyHasMore = true;
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
    total: totalCount,
    hasMore: anyHasMore,
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

  let data = await fetchJSON<{ data?: Array<{ url: string }>; url?: string }>(
    "song/url",
    params
  );

  // 上游取址失败率不低（实测抽样约 50% 返回空），失败时原音质重试一次，
  // 能明显提升点播成功率；重试仍失败才交给上层走跨平台回退
  let url = extractUrl(data);
  if (!url) {
    try {
      data = await fetchJSON<{ data?: Array<{ url: string }>; url?: string }>(
        "song/url",
        params
      );
      url = extractUrl(data);
    } catch {
      // 忽略：交给上层回退
    }
  }

  if (url) setCache(cacheKey, url);
  return url;
}

function extractUrl(data: { data?: Array<{ url: string }>; url?: string }): string {
  if (data.data && Array.isArray(data.data)) {
    return data.data[0]?.url || "";
  }
  if (typeof data.url === "string") return data.url;
  return "";
}

// ============ 搜索联想 ============

export interface SearchSuggest {
  artists: { name: string; id: number }[];
  songs: { name: string; artist: string }[];
}

const EMPTY_SUGGEST: SearchSuggest = { artists: [], songs: [] };

/** 搜索联想（输入时实时建议）。失败静默返回空，不打扰输入。 */
export async function searchSuggest(keywords: string): Promise<SearchSuggest> {
  const kw = keywords.trim();
  if (!kw) return EMPTY_SUGGEST;
  try {
    return await fetchJSON<SearchSuggest>("suggest", { keywords: kw });
  } catch {
    return EMPTY_SUGGEST;
  }
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
    const raw = localStorage.getItem(STORAGE_KEYS.audioQuality);
    if (!raw) return "high";
    // 设置页通过 saveToStorage 写入，值是 JSON 编码的（"smooth" 带引号），
    // 必须解析后再比较，否则带引号的字符串匹配不上 AUDIO_QUALITY 的键，
    // 会静默回落到默认音质（此前音质设置一直不生效就是这个原因）
    let value: unknown = raw;
    try {
      value = JSON.parse(raw);
    } catch {
      // 兼容可能存在的裸字符串
    }
    if (typeof value === "string" && value in AUDIO_QUALITY) {
      return value as AudioQuality;
    }
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

// 预加载（带上歌曲自己的平台信息，否则非网易云歌曲会查错平台）
export function prefetchSongUrl(song: Song) {
  const platform = (song.platform || "netease") as MusicPlatform;
  getSongUrl(song.id, undefined, platform, song.platformId).catch(() => {});
}


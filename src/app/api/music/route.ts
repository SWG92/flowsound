import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/platforms";
import type { MusicPlatform } from "@/lib/types";
import { logError } from "@/lib/logger";
import { NETEASE_BASE, NETEASE_HEADERS, FETCH_TIMEOUT } from "@/lib/constants";

type HandlerFn = (params: Record<string, string>) => Promise<unknown>;

const VALID_PLATFORMS: MusicPlatform[] = ["netease", "qq", "kugou"];

function resolvePlatform(request: NextRequest): MusicPlatform {
  const p = request.nextUrl.searchParams.get("platform");
  return p && VALID_PLATFORMS.includes(p as MusicPlatform)
    ? (p as MusicPlatform)
    : "netease";
}

// ============ Handler 实现 ============

const searchHandler: HandlerFn = async (params) => {
  const keywords = params.keywords || "";
  const offset = parseInt(params.offset || "0");
  const limit = Math.min(parseInt(params.limit || "30"), 50);
  const page = Math.floor(offset / limit) + 1;
  return getAdapter(params._platform as MusicPlatform).search(keywords, page, limit);
};

const songUrlHandler: HandlerFn = async (params) => {
  const id = params.id || params.platformId || "";
  const br = params.br || "320000";
  const adapter = getAdapter(params._platform as MusicPlatform);

  // 上游取址失败率不低（网易云限流时抽样约半数返回空），服务端重试一次再交给上层回退
  let url = await adapter.getSongUrl(id, br);
  let level = adapter.getLastLevel?.();
  if (!url) {
    await new Promise((r) => setTimeout(r, 250));
    url = await adapter.getSongUrl(id, br);
    level = adapter.getLastLevel?.() ?? level;
  }

  // 客户端 api.ts 期望 { data: [{ url }] } 格式；网易云还会带上实际音质等级
  return { data: [{ url, ...(level ? { level } : {}) }] };
};

const lyricHandler: HandlerFn = async (params) => {
  const id = params.id || params.platformId || "";
  const lyrics = await getAdapter(params._platform as MusicPlatform).getLyrics(id);
  return lyrics;
};

const playlistDetailHandler: HandlerFn = async (params) => {
  const id = params.id || "";
  const tracks = await getAdapter(params._platform as MusicPlatform).getPlaylistDetail(id);
  return { result: { tracks }, playlist: { tracks } };
};

// 搜索联想（网易云 suggest 接口，供搜索框输入时实时建议）
const suggestHandler: HandlerFn = async (params) => {
  const kw = (params.keywords || "").trim();
  if (!kw) return { artists: [], songs: [] };
  const res = await fetch(`${NETEASE_BASE}/api/search/suggest/web?s=${encodeURIComponent(kw)}`, {
    headers: NETEASE_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  const data = await res.json();
  const result = data.result || {};
  return {
    artists: (result.artists || []).slice(0, 4).map((a: { name: string; id: number }) => ({ name: a.name, id: a.id })),
    songs: (result.songs || []).slice(0, 5).map((s: { name: string; artists?: { name: string }[] }) => ({
      name: s.name,
      artist: (s.artists || []).map((x) => x.name).join(" / "),
    })),
  };
};

// ============ 路由映射 ============

const HANDLERS: Record<string, HandlerFn> = {
  search: searchHandler,
  "song/url": songUrlHandler,
  lyric: lyricHandler,
  "playlist/detail": playlistDetailHandler,
  suggest: suggestHandler,
};

// ============ Route handler ============

export async function GET(request: NextRequest) {
  const fn = request.nextUrl.searchParams.get("fn");
  if (!fn) {
    return NextResponse.json({ error: "Missing fn" }, { status: 400 });
  }

  const handler = HANDLERS[fn];
  if (!handler) {
    return NextResponse.json({ error: `Unknown fn: ${fn}` }, { status: 404 });
  }

  // 解析参数（注入 _platform 供 handler 使用）
  const params: Record<string, string> = {
    _platform: resolvePlatform(request),
  };
  request.nextUrl.searchParams.forEach((v, k) => {
    if (k !== "fn") params[k] = v;
  });

  try {
    const data = await handler(params);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    logError(`[music-api] ${params._platform}/${fn}:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

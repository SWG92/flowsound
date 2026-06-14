import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/platforms";
import type { MusicPlatform } from "@/lib/types";
import { logError } from "@/lib/logger";

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
  const url = await getAdapter(params._platform as MusicPlatform).getSongUrl(id);
  // 客户端 api.ts 期望 { data: [{ url }] } 格式
  return { data: [{ url }] };
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

const simiSongHandler: HandlerFn = async (params) => {
  const id = params.id || "";
  // 相似歌曲仅网易云支持
  return getAdapter("netease").getPlaylistDetail(id);
};

const simiArtistHandler: HandlerFn = async () => {
  return { artists: [] };
};

// ============ 路由映射 ============

const HANDLERS: Record<string, HandlerFn> = {
  search: searchHandler,
  "song/url": songUrlHandler,
  lyric: lyricHandler,
  "playlist/detail": playlistDetailHandler,
  "simi/song": simiSongHandler,
  "simi/artist": simiArtistHandler,
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

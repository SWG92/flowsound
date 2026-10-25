import { NextRequest, NextResponse } from "next/server";
import { NETEASE_HEADERS, FETCH_TIMEOUT, NETEASE_BASE } from "@/lib/constants";
import { logError } from "@/lib/logger";
import { getServerCache, setServerCache } from "@/lib/server-cache";
import { slimSongs } from "@/lib/song-slim";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // 专辑内容基本不变，长缓存减少回源（也降低触发上游风控的概率）
  const cacheKey = `album?id=${id}`;
  const cached = getServerCache<unknown>(cacheKey);
  if (cached !== null) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=1800" },
    });
  }

  try {
    // 用 v1 路径：老的 /api/album/{id} 现在常返回 code -462（触发网易云风控，
    // 提示"绑定手机后可进行下一步"），而 /api/v1/album/{id} 稳定可用并返回歌曲列表
    const res = await fetch(`${NETEASE_BASE}/api/v1/album/${id}`, {
      headers: NETEASE_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await res.json();
    if (data.code !== 200) {
      logError(`[album-api] ${id}: 上游返回 code=${data.code} ${data.message || ""}`);
      return NextResponse.json(
        { error: data.message || `上游错误 (code ${data.code})` },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }
    // 歌曲列表裁剪掉客户端不用的字段（音质详情/版权等），大幅减小响应体积；
    // 专辑元信息（封面/简介/发行时间）原样保留
    const slim = { ...data, songs: slimSongs(data.songs || []) };
    setServerCache(cacheKey, slim, 30 * 60 * 1000);
    return NextResponse.json(slim, {
      headers: { "Cache-Control": "private, max-age=1800" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    logError(`[album-api] ${id}:`, msg);
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

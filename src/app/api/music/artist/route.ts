import { NextRequest, NextResponse } from "next/server";
import { NETEASE_HEADERS, FETCH_TIMEOUT, NETEASE_BASE } from "@/lib/constants";
import { logError } from "@/lib/logger";
import { getServerCache, setServerCache } from "@/lib/server-cache";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // 歌手热门歌曲短时间不变，缓存减少回源
  const cacheKey = `artist?id=${id}`;
  const cached = getServerCache<unknown>(cacheKey);
  if (cached !== null) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=1800" },
    });
  }

  try {
    const res = await fetch(`${NETEASE_BASE}/api/artist/${id}`, {
      headers: NETEASE_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await res.json();
    setServerCache(cacheKey, data, 30 * 60 * 1000);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=1800" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    logError(`[artist-api] ${id}:`, msg);
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

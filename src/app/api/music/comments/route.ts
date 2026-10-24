import { NextRequest, NextResponse } from "next/server";
import { NETEASE_HEADERS, FETCH_TIMEOUT } from "@/lib/constants";
import { NETEASE_API } from "@/lib/constants";
import { logError } from "@/lib/logger";
import { getServerCache, setServerCache } from "@/lib/server-cache";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const limit = request.nextUrl.searchParams.get("limit") || "50";
  const offset = request.nextUrl.searchParams.get("offset") || "0";

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // 热门评论短时间不变，缓存减少回源（分页按 offset 区分键）
  const cacheKey = `comments?id=${id}&limit=${limit}&offset=${offset}`;
  const cached = getServerCache<unknown>(cacheKey);
  if (cached !== null) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }

  try {
    const url = `${NETEASE_API.comments(id)}?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: NETEASE_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await res.json();
    setServerCache(cacheKey, data, 5 * 60 * 1000);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    logError(`[comments-api] ${id}:`, msg);
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

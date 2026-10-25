import { NextRequest, NextResponse } from "next/server";
import { NETEASE_HEADERS, FETCH_TIMEOUT } from "@/lib/constants";
import { NETEASE_API } from "@/lib/constants";
import { logError } from "@/lib/logger";
import { getServerCache, setServerCache } from "@/lib/server-cache";
import { numParam } from "@/lib/validate";

export async function GET(request: NextRequest) {
  // id/limit/offset 纯数字验证——参数直接拼进上游 URL，防 query 注入
  const id = numParam(request.nextUrl.searchParams.get("id"), "");
  const limit = numParam(request.nextUrl.searchParams.get("limit"), "50");
  const offset = numParam(request.nextUrl.searchParams.get("offset"), "0");

  if (!id) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
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

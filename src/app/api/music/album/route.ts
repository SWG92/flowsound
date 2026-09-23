import { NextRequest, NextResponse } from "next/server";
import { NETEASE_HEADERS, FETCH_TIMEOUT, NETEASE_BASE } from "@/lib/constants";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
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
        { status: 502 }
      );
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    logError(`[album-api] ${id}:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

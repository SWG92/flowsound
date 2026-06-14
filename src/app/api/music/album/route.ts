import { NextRequest, NextResponse } from "next/server";
import { NETEASE_HEADERS, FETCH_TIMEOUT, NETEASE_BASE } from "@/lib/constants";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const res = await fetch(`${NETEASE_BASE}/api/album/${id}`, {
      headers: NETEASE_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    logError(`[album-api] ${id}:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

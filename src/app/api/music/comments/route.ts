import { NextRequest, NextResponse } from "next/server";
import { NETEASE_HEADERS, FETCH_TIMEOUT } from "@/lib/constants";
import { NETEASE_API } from "@/lib/constants";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const limit = request.nextUrl.searchParams.get("limit") || "50";
  const offset = request.nextUrl.searchParams.get("offset") || "0";

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const url = `${NETEASE_API.comments(id)}?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: NETEASE_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    logError(`[comments-api] ${id}:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { NETEASE_API, NETEASE_HEADERS, FETCH_TIMEOUT } from "@/lib/constants";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "song";
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const url =
    type === "artist" ? NETEASE_API.simiArtist : NETEASE_API.simiSong;
  const fullUrl = `${url}?id=${id}`;

  try {
    const res = await fetch(fullUrl, {
      headers: NETEASE_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    logError(`[simi-api] ${type}/${id}:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

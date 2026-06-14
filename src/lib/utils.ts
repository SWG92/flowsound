import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Song } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 获取歌曲封面 URL。
 * 只用专辑封面，不使用歌手头像（大部分是默认灰图，会导致所有封面看起来一样）。
 * 同时强制升级 HTTP → HTTPS。
 */
export function getCoverUrl(song: Song | null | undefined): string {
  if (!song) return "";
  const url = song.album?.picUrl || "";
  return url.replace(/^http:/, "https:");
}

// 平台适配器统一导出

export type { PlatformInfo, PlatformAdapter } from "./types";
export { PLATFORMS } from "./types";
export type { MusicPlatform } from "@/lib/types";
export { neteaseAdapter } from "./netease";
export { qqAdapter } from "./qq";
export { kugouAdapter } from "./kugou";

import type { MusicPlatform } from "@/lib/types";
import type { PlatformAdapter } from "./types";
import { neteaseAdapter } from "./netease";
import { qqAdapter } from "./qq";
import { kugouAdapter } from "./kugou";

/** 根据平台类型获取适配器 */
export function getAdapter(platform: MusicPlatform): PlatformAdapter {
  switch (platform) {
    case "netease":
      return neteaseAdapter;
    case "qq":
      return qqAdapter;
    case "kugou":
      return kugouAdapter;
    default:
      return neteaseAdapter;
  }
}

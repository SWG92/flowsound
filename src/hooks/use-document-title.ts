"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/lib/store";

const BASE_TITLE = "FlowSound — 让音乐流动起来";

/**
 * 浏览器标签页标题显示当前歌曲（"歌名 - 歌手｜FlowSound"）。
 * 切到其他标签页时一眼可见在听什么，与主流音乐网站一致；
 * 无歌曲或组件卸载时回退到站点标题。
 */
export function useDocumentTitle() {
  const currentSong = usePlayerStore((s) => s.currentSong);

  useEffect(() => {
    if (currentSong) {
      const artist = currentSong.artists?.map((a) => a.name).join(" / ") || "";
      document.title = `${currentSong.name}${artist ? ` - ${artist}` : ""}｜FlowSound`;
    } else {
      document.title = BASE_TITLE;
    }
    return () => {
      document.title = BASE_TITLE;
    };
  }, [currentSong]);
}

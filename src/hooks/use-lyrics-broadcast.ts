"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/store";
import { broadcastLyrics, onLyricsCommand } from "@/lib/lyrics-broadcast";
import { getCoverUrl } from "@/lib/utils";

function loadColorIdx(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(localStorage.getItem("flowsound_lyric_color") || "0");
  } catch { return 0; }
}

/** 向桌面悬浮歌词窗口实时广播播放状态，并接收控制命令 */
export function useLyricsBroadcast() {
  const prevIndexRef = useRef(-1);

  useEffect(() => {
    // 定期广播播放状态
    const interval = setInterval(() => {
      const {
        currentSong,
        lyrics,
        currentLyricIndex,
        isPlaying,
        currentTime,
        favorites,
      } = usePlayerStore.getState();

      if (currentLyricIndex !== prevIndexRef.current || currentSong) {
        prevIndexRef.current = currentLyricIndex;
        broadcastLyrics({
          type: "sync",
          songName: currentSong?.name,
          artist: currentSong?.artists?.map((a) => a.name).join(" / "),
          lyrics: lyrics.map((l) => ({ time: l.time, text: l.text, transText: l.transText })),
          currentIndex: currentLyricIndex,
          isPlaying,
          currentTime,
          coverUrl: getCoverUrl(currentSong),
          isFavorite: currentSong ? favorites.includes(currentSong.id) : false,
          lyricColorIdx: loadColorIdx(),
        });
      }
    }, 250);

    // 监听桌面窗口发来的控制命令
    const unsubCmd = onLyricsCommand((cmd) => {
      const store = usePlayerStore.getState();
      switch (cmd.type) {
        case "togglePlay":
          store.togglePlay();
          break;
        case "toggleFavorite": {
          const song = store.currentSong;
          if (song) store.toggleFavorite(song);
          break;
        }
        case "setColor":
          if (typeof cmd.value === "number") {
            localStorage.setItem("flowsound_lyric_color", String(cmd.value));
          }
          break;
        case "setLocked":
          // 锁状态由桌面窗口自行管理
          break;
      }
    });

    return () => {
      clearInterval(interval);
      unsubCmd();
    };
  }, []);
}

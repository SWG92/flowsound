"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/lib/store";
import { audioPlayer } from "@/lib/audio-player";

// 记录最后一次非零音量，供静音键恢复
let lastNonZeroVolume = 0.8;

export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // 忽略输入框、富文本编辑器和正在拖动的滑块内的按键
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable ||
        target?.closest?.('[role="slider"]')
      ) {
        return;
      }

      const {
        togglePlay, nextSong, prevSong, setVolume, volume,
      } = usePlayerStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        // Ctrl/Cmd + 左右：切歌
        case "ArrowRight":
          if (mod) {
            e.preventDefault();
            nextSong();
          } else if (!e.altKey) {
            // 普通左右：快进/快退 5 秒
            e.preventDefault();
            const { currentTime, duration } = usePlayerStore.getState();
            audioPlayer.seek(Math.min(currentTime + 5, duration || currentTime + 5));
          }
          break;
        case "ArrowLeft":
          if (mod) {
            e.preventDefault();
            prevSong();
          } else if (!e.altKey) {
            e.preventDefault();
            const { currentTime } = usePlayerStore.getState();
            audioPlayer.seek(Math.max(0, currentTime - 5));
          }
          break;
        // 音量保持 Ctrl/Cmd 修饰，避免抢占列表页的上下滚动
        case "ArrowUp":
          if (mod) {
            e.preventDefault();
            setVolume(Math.min(1, volume + 0.1));
          }
          break;
        case "ArrowDown":
          if (mod) {
            e.preventDefault();
            setVolume(Math.max(0, volume - 0.1));
          }
          break;
        // M：静音/取消静音
        case "KeyM":
          if (!mod && !e.altKey) {
            const v = usePlayerStore.getState().volume;
            if (v > 0) {
              lastNonZeroVolume = v;
              setVolume(0);
            } else {
              setVolume(lastNonZeroVolume);
            }
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

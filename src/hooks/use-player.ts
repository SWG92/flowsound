"use client";

import { useEffect, useCallback, useRef } from "react";
import { audioPlayer } from "@/lib/audio-player";
import { usePlayerStore } from "@/lib/store";

export function useAudioPlayer() {
  const prevSongUrl = useRef<string | null>(null);

  const { currentSong, isPlaying, volume, speed } = usePlayerStore();

  // 切换歌曲 - 只在 URL 变化时触发
  useEffect(() => {
    const url = currentSong?.url;
    if (!url) return;

    // 只有当 URL 真正变化时才播放新歌
    if (url !== prevSongUrl.current) {
      prevSongUrl.current = url;
      audioPlayer.play(url, volume, speed);
    }
  }, [currentSong?.url]); // 只依赖 URL，volume/speed 改变时不重新加载

  // 播放/暂停控制
  useEffect(() => {
    if (!currentSong?.url) return;

    if (isPlaying) {
      audioPlayer.resume();
    } else {
      audioPlayer.pause();
    }
  }, [isPlaying]);

  // 音量控制
  useEffect(() => {
    audioPlayer.setVolume(volume);
  }, [volume]);

  // 倍速控制
  useEffect(() => {
    audioPlayer.setSpeed(speed);
  }, [speed]);

  // 跳转到指定时间
  const seek = useCallback((time: number) => {
    audioPlayer.seek(time);
  }, []);

  // 格式化时间
  const formatTime = useCallback((seconds: number): string => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  return { seek, formatTime };
}

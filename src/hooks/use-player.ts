"use client";

import { useEffect, useCallback, useRef } from "react";
import { audioPlayer } from "@/lib/audio-player";
import { usePlayerStore, playbackRestored } from "@/lib/store";

export function useAudioPlayer() {
  const prevSongUrl = useRef<string | null>(null);

  // 字段级订阅：store 其他切片（currentTime/lyrics 等）变化不再引发宿主组件重渲染
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const speed = usePlayerStore((s) => s.speed);
  // 重播信号：单曲循环/重播同曲时 URL 不变，靠 nonce 触发 replay
  const replayNonce = usePlayerStore((s) => s.replayNonce);

  // 播放调度 - URL 变化播新歌；URL 未变但 nonce 变化 = 重播当前歌（回开头继续放）
  useEffect(() => {
    const url = currentSong?.url;
    if (!url) return;

    if (url !== prevSongUrl.current) {
      prevSongUrl.current = url;
      audioPlayer.play(url, volume, speed);
      // 快照恢复（刷新/重启后续播）：store.currentTime >3s 说明是从进度恢复，
      // 播起来后跳回快照进度（正常切歌时 playSong 已把 currentTime 归零，不受影响）
      const savedTime = usePlayerStore.getState().currentTime;
      if (savedTime > 3) {
        setTimeout(() => audioPlayer.seek(savedTime), 150);
      }
      // 快照为暂停态：静音起播到进度再压回暂停（不出声、状态正确）
      if (playbackRestored && !usePlayerStore.getState().isPlaying) {
        const v = usePlayerStore.getState().volume;
        audioPlayer.setVolume(0);
        setTimeout(() => {
          audioPlayer.seek(savedTime);
          audioPlayer.pause();
          audioPlayer.setVolume(v);
        }, 260);
      }
    } else {
      audioPlayer.replay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意只依赖 URL/nonce：volume/speed 各有独立 effect 同步，不应触发重载
  }, [currentSong?.url, replayNonce]);

  // 播放/暂停控制
  useEffect(() => {
    if (!currentSong?.url) return;

    if (isPlaying) {
      audioPlayer.resume();
    } else {
      audioPlayer.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意只依赖 isPlaying：URL 变化由上面的 effect 负责，切歌时的 resume 会导致双重起播
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

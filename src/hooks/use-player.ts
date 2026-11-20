"use client";

import { useEffect, useCallback, useRef } from "react";
import { audioPlayer } from "@/lib/audio-player";
import { usePlayerStore, playbackRestored } from "@/lib/store";
import { getLyrics } from "@/lib/api";
import type { MusicPlatform } from "@/lib/types";

// 快照恢复意图：仅启动后的首次起播消费一次。
// 恢复策略：启动只还原界面现场（歌 + 队列 + 进度），不预载音频、不自动播放——
// 快照里的 URL 可能已过期，预载只会白跑一次注定失败的请求。用户按播放时
// （isPlaying effect 检测到无音频实例）走 playSong 完整链路重新取址（含跨平台
// 回退），从快照进度精准续播。之后回归正常播放调度，不受影响。
let restorePending = playbackRestored;
// 恢复态首次起播要续播到快照进度：playSong 会把 currentTime 清零，先暂存到这里，
// 由播放调度 effect 消费一次性转为 startAt。带歌曲 id 校验——若恢复的歌不可播
// 触发了自动跳下一首，进度不能错误地带到新歌上
let restoreSeek: { id: number; time: number } | null = null;

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

    // 恢复态起播：把暂存的快照进度转成本次起播定位（仅限同一首歌、>3s 才补跳）
    const seekAt = restoreSeek && currentSong && restoreSeek.id === currentSong.id
      ? restoreSeek.time
      : null;
    restoreSeek = null;
    const opts = seekAt && seekAt > 3 ? { startAt: seekAt } : undefined;

    if (url !== prevSongUrl.current) {
      prevSongUrl.current = url;
      if (restorePending) {
        // 启动恢复：只记录快照 URL，不预载音频（等用户按播放重新取址）
        restorePending = false;
        // 恢复态补拉歌词：暂停现场也能看到歌词（起播后 playSong 会再取，
        // 命中内存缓存不浪费请求）；失败静默，起播时还有完整跨平台回退链路
        const s = usePlayerStore.getState();
        if (s.currentSong && s.lyrics.length === 0) {
          getLyrics(
            s.currentSong.id,
            (s.currentSong.platform || "netease") as MusicPlatform,
            s.currentSong.platformId
          )
            .then((l) => {
              if (l.length > 0) usePlayerStore.getState().setLyrics(l);
            })
            .catch(() => {});
        }
        return;
      }
      audioPlayer.play(url, volume, speed, opts);
    } else if (audioPlayer.getHowl()) {
      audioPlayer.replay();
    } else {
      // URL 相同但还没有音频实例（恢复态重新取址恰好拿到同一地址）
      audioPlayer.play(url, volume, speed, opts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意只依赖 URL/nonce：volume/speed 各有独立 effect 同步，不应触发重载
  }, [currentSong?.url, replayNonce]);

  // 播放/暂停控制
  useEffect(() => {
    if (!currentSong?.url) return;

    if (isPlaying) {
      // 恢复态首次起播：音频尚未加载（启动不预载），走 playSong 重新取址续播
      if (!audioPlayer.getHowl()) {
        const s = usePlayerStore.getState();
        if (s.currentSong) restoreSeek = { id: s.currentSong.id, time: s.currentTime };
        s.playSong(s.currentSong!, s.queue, s.sourceList);
        return;
      }
      audioPlayer.resume();
    } else {
      audioPlayer.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意只依赖 isPlaying：URL 变化由上面的 effect 负责处理，避免双重起播/暂停竞争
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

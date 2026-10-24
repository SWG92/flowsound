"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/lib/store";
import { audioPlayer } from "@/lib/audio-player";
import { getCoverUrl } from "@/lib/utils";

/**
 * 接入 Media Session API，实现系统级媒体控制：
 * - 锁屏 / 通知中心显示歌曲信息和封面
 * - 响应系统媒体键（播放/暂停/上一首/下一首/快进快退）
 * - 显示播放进度条
 */
export function useMediaSession() {
  // 只订阅元数据相关的两个字段：播放进度等高频状态不订阅（避免每 250ms 重渲染），
  // 需要时从 getState() 读取
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // 设置元数据 + 操作处理器
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const song = currentSong;
    if (!song) {
      navigator.mediaSession.metadata = null;
      return;
    }

    // 歌曲封面
    const coverUrl = getCoverUrl(song);
    const artwork: MediaImage[] = [];
    if (coverUrl) {
      artwork.push({ src: coverUrl + "?param=256y256", sizes: "256x256", type: "image/jpeg" });
      artwork.push({ src: coverUrl + "?param=512y512", sizes: "512x512", type: "image/jpeg" });
    }

    // 设置元数据
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name || "未知歌曲",
      artist: song.artists?.map((a) => a.name).join(" / ") || "未知歌手",
      album: song.album?.name || "",
      artwork,
    });

    // 更新播放状态
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    syncPositionState();
  }, [currentSong, isPlaying]);

  // 定期同步播放位置（Media Session API 要求持续更新位置）
  useEffect(() => {
    if (!("mediaSession" in navigator) || !("setPositionState" in navigator.mediaSession)) return;

    const interval = setInterval(() => {
      if (usePlayerStore.getState().isPlaying) {
        syncPositionState();
      }
    }, 5000); // 每5秒同步一次

    return () => clearInterval(interval);
  }, []);

  // 设置操作处理器（只设置一次）
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => { usePlayerStore.getState().togglePlay(); }],
      ["pause", () => { usePlayerStore.getState().togglePlay(); }],
      ["previoustrack", () => { usePlayerStore.getState().prevSong(); }],
      ["nexttrack", () => { usePlayerStore.getState().nextSong(); }],
      ["seekbackward", (details) => {
        const offset = details.seekOffset || 10;
        const newTime = Math.max(0, getPosition() - offset);
        audioPlayer.seek(newTime);
      }],
      ["seekforward", (details) => {
        const offset = details.seekOffset || 10;
        const newTime = Math.min(getDuration() || 0, getPosition() + offset);
        audioPlayer.seek(newTime);
      }],
      ["seekto", (details) => {
        if (details.seekTime != null) {
          audioPlayer.seek(details.seekTime);
        }
      }],
      ["stop", () => {
        usePlayerStore.getState().setPlaying(false);
      }],
    ];

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // 某些操作可能不支持
      }
    }

    return () => {
      // 清理所有处理器
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch { /* ignore */ }
      }
    };
  }, []);
}

// ===== 位置状态读取（不触发 React 重渲染） =====

function getPosition() {
  return usePlayerStore.getState().currentTime;
}

function getDuration() {
  return usePlayerStore.getState().duration;
}

function syncPositionState() {
  if (!("mediaSession" in navigator) || !("setPositionState" in navigator.mediaSession)) return;
  const { duration, speed, currentTime } = usePlayerStore.getState();
  try {
    navigator.mediaSession.setPositionState({
      duration: duration || 0,
      playbackRate: speed || 1,
      position: currentTime || 0,
    });
  } catch {
    // setPositionState 可能在某些平台抛出异常
  }
}

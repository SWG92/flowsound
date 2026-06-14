"use client";

import { useEffect, useState } from "react";
import { audioPlayer } from "@/lib/audio-player";

/**
 * 监听音频播放状态，驱动可视化条的激活/休眠切换。
 *
 * 注意：网易云 CDN 音频 URL 为跨域资源，无 CORS 头，
 * 无法使用 Web Audio API（createMediaElementSource / decodeAudioData 均会失败）。
 * 因此可视化条使用 CSS 动画作为可靠的降级方案。
 */
export function useVisualizer(_fftSize = 64) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // 订阅歌曲开始事件来追踪播放状态
    const unsub = audioPlayer.onSongStart(() => {
      setIsPlaying(true);
    });

    // 轮询检查播放状态（Howler 没有暴露播放状态变更事件）
    const interval = setInterval(() => {
      const howl = audioPlayer.getHowl();
      const playing = howl ? howl.playing() : false;
      setIsPlaying(playing);
    }, 300);

    return () => {
      unsub();
      clearInterval(interval);
      setIsPlaying(false);
    };
  }, []);

  return {
    frequencies: [],        // 无真实频谱数据
    isActive: isPlaying,    // 播放中 → 激活 CSS 动画条
  };
}

"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/store";
import {
  broadcastLyrics,
  writeHeartbeat,
  onLyricsCommand,
  takePendingCommands,
  type LyricsCommand,
  type LyricsMessage,
} from "@/lib/lyrics-broadcast";
import { getCoverUrl } from "@/lib/utils";

function loadColorIdx(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(localStorage.getItem("flowsound_lyric_color") || "0");
  } catch { return 0; }
}

/** 从 store 组装同步载荷（广播与 ping 应答共用） */
function buildPayload(): LyricsMessage {
  const {
    currentSong,
    lyrics,
    currentLyricIndex,
    isPlaying,
    favorites,
  } = usePlayerStore.getState();

  const isFav = currentSong ? favorites.includes(currentSong.id) : false;
  return {
    type: "sync",
    songName: currentSong?.name,
    artist: currentSong?.artists?.map((a) => a.name).join(" / "),
    lyrics: lyrics.map((l) => ({ time: l.time, text: l.text, transText: l.transText })),
    currentIndex: currentLyricIndex,
    isPlaying,
    currentTime: usePlayerStore.getState().currentTime,
    coverUrl: getCoverUrl(currentSong),
    isFavorite: isFav,
    lyricColorIdx: loadColorIdx(),
  };
}

/** 向桌面悬浮歌词窗口实时广播播放状态，并接收控制命令 */
export function useLyricsBroadcast() {
  // 变化签名：只在内容真正变化时全量广播，避免每 250ms 序列化歌词
  const sigRef = useRef("");
  // 命令去重：广播与 localStorage 队列两条通道都会送达同一条命令
  const processedCmds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let lastHeartbeat = 0;

    const interval = setInterval(() => {
      const state = usePlayerStore.getState();
      const isFav = state.currentSong ? state.favorites.includes(state.currentSong.id) : false;
      const sig = `${state.currentSong?.id ?? ""}|${state.currentLyricIndex}|${state.isPlaying}|${isFav}|${state.lyrics.length}`;

      if (sig !== sigRef.current) {
        sigRef.current = sig;
        broadcastLyrics(buildPayload());
        lastHeartbeat = Date.now();
        return;
      }

      // 内容未变化时保持心跳活性（供桌面窗口判断主窗口是否在线）。
      // 有歌在播或界面打开时心跳都保持，桌面窗口据此显示最后状态而不是超时消失。
      if (state.currentSong && Date.now() - lastHeartbeat > 2000) {
        writeHeartbeat();
        lastHeartbeat = Date.now();
      }

      // 消费 localStorage 命令队列（广播通道不可用环境的兜底）
      for (const cmd of takePendingCommands()) {
        processCommand(cmd, processedCmds.current);
      }
    }, 500);

    // 监听桌面窗口发来的控制命令（广播通道）
    const unsubCmd = onLyricsCommand((cmd) => {
      processCommand(cmd, processedCmds.current);
    });

    return () => {
      clearInterval(interval);
      unsubCmd();
    };
  }, []);
}

/** 处理一条控制命令（按 ID 去重，两条通道送达同一条命令只执行一次） */
function processCommand(cmd: LyricsCommand, processed: Set<string>) {
  if (!cmd?.type) return;
  if (cmd.id) {
    if (processed.has(cmd.id)) return;
    processed.add(cmd.id);
    // 控制集合体积
    if (processed.size > 200) {
      // Set 保序，清掉最早的一半
      const iter = processed.values();
      for (let i = 0; i < 100; i++) {
        const v = iter.next().value;
        if (v !== undefined) processed.delete(v);
      }
    }
  }

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
    case "ping":
      // 桌面窗口刚打开（或重连）时索要一次全量状态。
      // 广播通道不可用的环境里，这次调用会刷新 localStorage 快照与心跳，
      // 窗口的兜底轮询立刻就能拿到数据。
      broadcastLyrics(buildPayload());
      break;
  }
}

"use client";

const CHANNEL_NAME = "flowsound-lyrics";
const CMD_CHANNEL_NAME = "flowsound-lyrics-cmd";

export interface LyricsMessage {
  type: "sync" | "ping";
  songName?: string;
  artist?: string;
  lyrics?: { time: number; text: string; transText?: string }[];
  currentIndex?: number;
  isPlaying?: boolean;
  currentTime?: number;
  coverUrl?: string;
  isFavorite?: boolean;
  lyricColorIdx?: number;
  locked?: boolean;
}

export interface LyricsCommand {
  type: "togglePlay" | "toggleFavorite" | "setColor" | "setLocked" | "close";
  value?: number | boolean;
}

let channel: BroadcastChannel | null = null;
let cmdChannel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel {
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

function getCmdChannel(): BroadcastChannel {
  if (!cmdChannel) cmdChannel = new BroadcastChannel(CMD_CHANNEL_NAME);
  return cmdChannel;
}

/** 主窗口：向悬浮歌词窗发送同步数据 */
export function broadcastLyrics(data: LyricsMessage) {
  try {
    getChannel().postMessage(data);
    localStorage.setItem("flowsound_lyrics_state", JSON.stringify({ ...data, _ts: Date.now() }));
  } catch { /* ignore */ }
}

/** 主窗口：监听悬浮窗发来的控制命令 */
export function onLyricsCommand(callback: (data: LyricsCommand) => void): () => void {
  const bc = getCmdChannel();
  const handler = (e: MessageEvent<LyricsCommand>) => callback(e.data);
  bc.addEventListener("message", handler);
  return () => bc.removeEventListener("message", handler);
}

/** 悬浮窗：监听主窗口的歌词同步 */
export function onLyricsBroadcast(callback: (data: LyricsMessage) => void): () => void {
  const bc = getChannel();
  const handler = (e: MessageEvent<LyricsMessage>) => callback(e.data);
  bc.addEventListener("message", handler);
  return () => bc.removeEventListener("message", handler);
}

/** 悬浮窗：向主窗口发送控制命令 */
export function sendLyricsCommand(cmd: LyricsCommand) {
  try {
    getCmdChannel().postMessage(cmd);
  } catch { /* ignore */ }
}

/** 打开桌面悬浮歌词窗口 */
export function openDesktopLyrics() {
  const w = 460;
  const h = 620;
  const left = window.screen.width - w - 30;
  const top = (window.screen.height - h) / 2;

  const features = [
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
    "resizable=yes",
    "scrollbars=no",
  ].join(",");

  const win = window.open("/lyrics-desktop", "flowsound-lyrics", features);
  if (win) win.focus();
  return win;
}

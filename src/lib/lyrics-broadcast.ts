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
  type: "togglePlay" | "toggleFavorite" | "setColor" | "setLocked" | "close" | "ping";
  value?: number | boolean;
}

const STATE_KEY = "flowsound_lyrics_state";
const HEARTBEAT_KEY = "flowsound_lyrics_hb";

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
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...data, _ts: Date.now() }));
    writeHeartbeat();
  } catch { /* ignore */ }
}

/**
 * 心跳：只写一个时间戳（不重复序列化完整歌词）。
 * 桌面歌词窗口用它判断主窗口是否还活着 —— 有些环境（如多标签页隔离的浏览器）
 * BroadcastChannel 不跨标签页，localStorage 快照 + 心跳新鲜度是唯一的同步通道；
 * 主窗口仅在内容变化时写快照，快照可能长时间不更新，心跳保持活性判断准确。
 */
export function writeHeartbeat() {
  try {
    localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

/** 桌面窗口：主窗口心跳是否新鲜（6 秒内有写入） */
export function isHeartbeatFresh(): boolean {
  try {
    const ts = Number(localStorage.getItem(HEARTBEAT_KEY) || 0);
    return ts > 0 && Date.now() - ts < 6000;
  } catch {
    return false;
  }
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

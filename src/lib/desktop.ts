"use client";

// Electron 桌面壳桥接的类型化访问（浏览器环境返回 null，调用方判空跳过）
export interface FlowSoundDesktop {
  isDesktop: boolean;
  onMediaCommand(cb: (cmd: string) => void): void;
  windowMinimize(): void;
  windowMaxToggle(): void;
  windowClose(): void;
  onWindowState(cb: (s: { maximized: boolean; fullscreen: boolean }) => void): void;
  setCloseAction(a: "tray" | "exit"): void;
  setProgress(v: number): void;
  setTrayState(s: { playing: boolean; title: string }): void;
  openLyrics(): void;
  setLyricsClickThrough(on: boolean): void;
  setLyricsPinned(on: boolean): void;
  checkForUpdates(): Promise<unknown>;
  onUpdateStatus(cb: (s: { type: string; version?: string; percent?: number; message?: string }) => void): void;
  getAppVersion(): Promise<string>;
}

export function getDesktop(): FlowSoundDesktop | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { flowsoundDesktop?: FlowSoundDesktop }).flowsoundDesktop ?? null;
}

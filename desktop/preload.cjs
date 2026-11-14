// FlowSound 预加载桥：向渲染层暴露最小桌面能力
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flowsoundDesktop", {
  isDesktop: true,
  // —— 媒体键（主进程 → 渲染层）——
  onMediaCommand: (cb) => {
    ipcRenderer.on("media-command", (_e, cmd) => cb(cmd));
  },
  // —— 窗口控制（自绘标题栏用）——
  windowMinimize: () => ipcRenderer.send("window-minimize"),
  windowMaxToggle: () => ipcRenderer.send("window-max-toggle"),
  windowClose: () => ipcRenderer.send("window-close"),
  onWindowState: (cb) => {
    ipcRenderer.on("window-state", (_e, s) => cb(s));
  },
  // —— 关闭行为（tray | exit）——
  setCloseAction: (a) => ipcRenderer.send("set-close-action", a),
  // —— 任务栏进度条（0~1，-1 移除）——
  setProgress: (v) => ipcRenderer.send("set-progress", v),
  // —— 托盘播放态（图标 + tooltip 歌名）——
  setTrayState: (s) => ipcRenderer.send("set-tray-state", s),
  // —— 桌面悬浮歌词窗口 ——
  openLyrics: () => ipcRenderer.send("open-lyrics"),
  setLyricsClickThrough: (on) => ipcRenderer.send("lyrics-click-through", on),
  setLyricsPinned: (on) => ipcRenderer.send("set-lyrics-pinned", on),
  // —— 自动更新 ——
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  onUpdateStatus: (cb) => {
    ipcRenderer.on("update-status", (_e, s) => cb(s));
  },
  getAppVersion: () => ipcRenderer.invoke("app-version"),
});

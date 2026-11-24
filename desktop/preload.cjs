// FlowSound 预加载桥：向渲染层暴露最小桌面能力
const { contextBridge, ipcRenderer } = require("electron");

// 桌面壳标记：在首帧绘制前就打到 <html> 上，渲染层的 Web 进场动画
// 据此用 CSS 隐藏（桌面端用原生启动屏，避免双重动画）。
// 必须在 preload 里做——等 hydration 后再判断会闪一下且产生水合分歧
try { document.documentElement.classList.add("fs-desktop"); } catch { /* ignore */ }

contextBridge.exposeInMainWorld("flowsoundDesktop", {
  isDesktop: true,
  // —— 媒体键（主进程 → 渲染层）——
  onMediaCommand: (cb) => {
    const h = (_e, cmd) => cb(cmd);
    ipcRenderer.on("media-command", h);
    return () => ipcRenderer.removeListener("media-command", h);
  },
  // —— 窗口控制（自绘标题栏用）——
  windowMinimize: () => ipcRenderer.send("window-minimize"),
  windowMaxToggle: () => ipcRenderer.send("window-max-toggle"),
  windowClose: () => ipcRenderer.send("window-close"),
  onWindowState: (cb) => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on("window-state", h);
    return () => ipcRenderer.removeListener("window-state", h);
  },
  // —— 关闭行为（tray | exit）——
  setCloseAction: (a) => ipcRenderer.send("set-close-action", a),
  // —— 任务栏进度条（0~1，-1 移除）——
  setProgress: (v) => ipcRenderer.send("set-progress", v),
  // —— 托盘播放态（图标 + tooltip 歌名）——
  setTrayState: (s) => ipcRenderer.send("set-tray-state", s),
  // —— 清理磁盘缓存（HTTP 缓存 + 更新器遗留安装包，不动用户数据）——
  clearDiskCache: () => ipcRenderer.invoke("clear-disk-cache"),
  // —— 自动更新 ——
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  restartForUpdate: () => ipcRenderer.send("quit-and-install"),
  onUpdateStatus: (cb) => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on("update-status", h);
    return () => ipcRenderer.removeListener("update-status", h);
  },
  getAppVersion: () => ipcRenderer.invoke("app-version"),
});

// FlowSound 预加载桥：向渲染层暴露最小桌面能力（媒体键、更新检查）
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flowsoundDesktop", {
  isDesktop: true,
  onMediaCommand: (cb) => {
    ipcRenderer.on("media-command", (_e, cmd) => cb(cmd));
  },
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  onUpdateStatus: (cb) => {
    ipcRenderer.on("update-status", (_e, s) => cb(s));
  },
});

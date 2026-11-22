// 启动屏专用 preload：点击任意位置跳过启动屏（主窗口就绪前不生效，见 main.cjs）
const { ipcRenderer } = require("electron");

window.addEventListener("mousedown", () => {
  try {
    ipcRenderer.send("splash:skip");
  } catch {
    /* ignore */
  }
});

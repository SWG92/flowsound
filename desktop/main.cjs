// FlowSound Electron 主进程
// 职责：启动内嵌 Next.js standalone 服务器 → 创建无框主窗口（自绘标题栏）→
//       托盘常驻（播放态图标/tooltip）→ 全局媒体键 → 桌面悬浮歌词窗口 →
//       任务栏进度条 → 软件内自动更新（electron-updater + GitHub Releases）
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, dialog, shell, nativeImage, screen } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");
const fs = require("fs");

const BASE_PORT = 37120;      // 内嵌服务器起始端口（避开常用 3000，冲突自动 +1 重试）
const PORT_RETRY = 20;

let serverProc = null;
let serverPort = 0;
let mainWindow = null;
let lyricsWin = null;
let tray = null;
let quitting = false;
let closeAction = "tray";     // 关闭按钮行为：tray=最小化到托盘 / exit=直接退出（设置页可改）
let lyricsPinned = true;      // 歌词横幅置顶默认开（桌面歌词本该浮在最上，横幅上图钉可关）
let isPlayingState = false;
let playingTitle = "";

// 单实例锁：二次启动唤起已有窗口
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// ============ 内嵌 Next.js standalone 服务器 ============

// standalone 目录：打包后在 resources/server；开发时在项目 .next/standalone
function standaloneDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "server")
    : path.join(__dirname, "..", ".next", "standalone");
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

// 用 Electron 自带的 Node 运行 standalone server.js（ELECTRON_RUN_AS_NODE），
// 用户机器无需安装 Node。NODE_TLS_REJECT_UNAUTHORIZED=0 与本地构建一致（上游音乐接口需要）
function spawnServer(serverDir, port) {
  const entry = path.join(serverDir, "server.js");
  if (!fs.existsSync(entry)) return null;
  const proc = spawn(process.execPath, [entry], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  proc.stderr.on("data", (d) => console.error("[server]", String(d).trim()));
  proc.on("exit", (code) => console.error("[server] exited:", code));
  return proc;
}

// 轮询等待服务器可响应
function waitReady(port, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 1500 }, (res) => {
        res.resume();
        resolve(port);
      });
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) reject(new Error("内嵌服务器启动超时"));
        else setTimeout(tick, 300);
      });
    };
    tick();
  });
}

async function startServer() {
  const dir = standaloneDir();
  if (fs.existsSync(path.join(dir, "server.js"))) {
    for (let p = BASE_PORT; p < BASE_PORT + PORT_RETRY; p++) {
      if (!(await isPortFree(p))) continue;
      serverProc = spawnServer(dir, p);
      if (!serverProc) throw new Error("内嵌服务器文件缺失（standalone 构建不完整）");
      await waitReady(p);
      serverPort = p;
      return;
    }
    throw new Error("无可用端口（37120~37139 均被占用）");
  }
  if (!app.isPackaged) {
    // 开发回退：没跑 standalone 构建时，期望项目本身的 npm start 已在跑
    await waitReady(3000, 4000).catch(() => {
      throw new Error("开发模式请先运行 npm run build（standalone）或 npm start");
    });
    serverPort = 3000;
    return;
  }
  throw new Error("内嵌服务器文件缺失（resources/server）");
}

// ============ 主窗口（无框 + 自绘标题栏）============

function resIcon(file) {
  const dir = app.isPackaged ? process.resourcesPath : path.join(__dirname, "build");
  return nativeImage.createFromPath(path.join(dir, file));
}

function appIcon() {
  return resIcon("icon.png");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    frame: false,              // 无框：标题栏由渲染层 DesktopTitleBar 自绘（汽水音乐同款集成式）
    backgroundColor: "#0b0b12",
    autoHideMenuBar: true,
    show: false,
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  // 关闭按钮行为由设置决定：tray=最小化到托盘 / exit=直接退出
  mainWindow.on("close", (e) => {
    if (quitting || closeAction === "exit") {
      quitting = true;
      return;
    }
    e.preventDefault();
    mainWindow.hide();
  });

  // 站外链接一律走系统浏览器；桌面歌词页转原生悬浮窗
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.origin === `http://127.0.0.1:${serverPort}` && u.pathname === "/lyrics-desktop") {
        openLyricsWindow();
        return { action: "deny" };
      }
    } catch { /* 非法 URL 走默认拒绝 */ }
    if (/^https?:/i.test(url) && !url.startsWith(`http://127.0.0.1:${serverPort}`)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // 最大化/全屏状态变化 → 渲染层标题栏切换图标
  const sendWinState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("window-state", {
        maximized: mainWindow.isMaximized(),
        fullscreen: mainWindow.isFullScreen(),
      });
    }
  };
  mainWindow.on("maximize", sendWinState);
  mainWindow.on("unmaximize", sendWinState);
  mainWindow.on("enter-full-screen", sendWinState);
  mainWindow.on("leave-full-screen", sendWinState);
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ============ 托盘（播放态图标 + tooltip 歌名）============

function trayIconFor(playing) {
  const img = resIcon(playing ? "icon-playing.png" : "icon.png");
  return img.isEmpty() ? appIcon() : img.resize({ width: 32, height: 32 });
}

function updateTrayState(s) {
  if (s && typeof s === "object") {
    if (typeof s.playing === "boolean") isPlayingState = s.playing;
    if (typeof s.title === "string") playingTitle = s.title;
  }
  if (tray) {
    tray.setImage(trayIconFor(isPlayingState));
    tray.setToolTip(
      playingTitle
        ? `${isPlayingState ? "正在播放" : "已暂停"}：${playingTitle} — FlowSound`
        : "FlowSound — 让音乐流动起来"
    );
  }
}

function createTray() {
  tray = new Tray(trayIconFor(false));
  tray.setToolTip("FlowSound — 让音乐流动起来");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示主界面", click: showWindow },
      { label: "桌面悬浮歌词", click: () => openLyricsWindow() },
      { label: "检查更新", click: () => checkUpdates(true) },
      {
        label: "开机自启",
        type: "checkbox",
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) =>
          app.setLoginItemSettings({ openAtLogin: item.checked, path: process.execPath }),
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("double-click", showWindow);
}

// ============ 桌面悬浮歌词窗口 ============

// 尺寸/位置持久化（FloatLyrics 同款：userData JSON）
const LYRICS_MIN = { width: 480, height: 180 };
let lyricsBoundsTimer = null;
let overlayResize = null;

function lyricsBoundsFile() {
  return path.join(app.getPath("userData"), "lyrics-window-bounds-v2.json");
}
function loadLyricsBounds() {
  try {
    const raw = JSON.parse(fs.readFileSync(lyricsBoundsFile(), "utf-8"));
    if (raw && Number.isFinite(raw.width) && Number.isFinite(raw.height)) return raw;
  } catch { /* ignore */ }
  return null;
}
function saveLyricsBounds(win) {
  try {
    fs.writeFileSync(lyricsBoundsFile(), JSON.stringify(win.getBounds()));
  } catch { /* 窗口持久化不打扰歌词展示 */ }
}
function scheduleLyricsBoundsSave() {
  if (lyricsBoundsTimer) clearTimeout(lyricsBoundsTimer);
  lyricsBoundsTimer = setTimeout(() => {
    if (lyricsWin && !lyricsWin.isDestroyed()) saveLyricsBounds(lyricsWin);
  }, 250);
}

function openLyricsWindow() {
  // 已开着 → 显示并聚焦（不做关闭切换：避免误触把歌词窗藏起来找不到）
  if (lyricsWin && !lyricsWin.isDestroyed()) {
    lyricsWin.show();
    lyricsWin.focus();
    return;
  }
  // FloatLyrics 验证配方：transparent + resizable:false（缩放走右下角 grip IPC，
  // 规避 WS_THICKFRAME 在 DPI 缩放下拖动变大的 bug）+ bounds 持久化
  const initialBounds = loadLyricsBounds();
  const { workArea } = screen.getPrimaryDisplay();
  const w = initialBounds?.width ?? 1150;
  const h = initialBounds?.height ?? 150;
  const x = initialBounds?.x ?? workArea.x + Math.round((workArea.width - w) / 2);
  const y = initialBounds?.y ?? workArea.y + Math.max(0, workArea.height - h - 110);
  lyricsWin = new BrowserWindow({
    x, y, width: w, height: h,
    minWidth: LYRICS_MIN.width,
    minHeight: LYRICS_MIN.height,
    frame: false,
    transparent: false,        // 透明窗在部分显卡/驱动下 alpha 被丢弃（实锤），改不透明
    backgroundColor: "#262b36",
    hasShadow: true,
    roundedCorners: true,      // Win11 系统圆角
    resizable: false,
    maximizable: false,
    alwaysOnTop: lyricsPinned,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  if (lyricsPinned) lyricsWin.setAlwaysOnTop(true);
  // 注意：不要调用 setVisibleOnAllWorkspaces——Windows 上实测会把窗口整个藏起来
  lyricsWin.loadURL(`http://127.0.0.1:${serverPort}/lyrics-bar`);
  lyricsWin.on("close", () => {
    if (lyricsWin) saveLyricsBounds(lyricsWin);
  });
  lyricsWin.on("closed", () => {
    overlayResize = null;
    lyricsWin = null;
  });
  lyricsWin.on("resize", scheduleLyricsBoundsSave);
  lyricsWin.on("move", scheduleLyricsBoundsSave);
}

// ============ 全局媒体键 ============

function registerMediaKeys() {
  const send = (cmd) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("media-command", cmd);
    }
  };
  // 键盘播放键直接控制 FlowSound（全局生效，与系统播放器一致）
  globalShortcut.register("MediaPlayPause", () => send("playpause"));
  globalShortcut.register("MediaNextTrack", () => send("next"));
  globalShortcut.register("MediaPreviousTrack", () => send("prev"));
}

// ============ 软件内自动更新 ============

const { autoUpdater } = require("electron-updater");

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", payload);
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.on("update-available", (info) => {
    sendUpdateStatus({ type: "available", version: info.version });
    try {
      tray?.displayBalloon({
        iconType: "info",
        title: "FlowSound 发现新版本",
        content: `v${info.version} 正在后台下载…`,
      });
    } catch { /* 非 Windows 忽略 */ }
  });
  autoUpdater.on("download-progress", (p) => {
    sendUpdateStatus({ type: "progress", percent: Math.round(p.percent) });
  });
  autoUpdater.on("update-downloaded", async (info) => {
    sendUpdateStatus({ type: "downloaded", version: info.version });
    const r = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "更新就绪",
      message: `新版本 v${info.version} 已下载完成`,
      detail: "重启 FlowSound 即可完成更新。",
      buttons: ["立即重启", "稍后"],
      defaultId: 0,
    });
    if (r.response === 0) {
      quitting = true;
      autoUpdater.quitAndInstall();
    }
  });
  autoUpdater.on("error", (e) => {
    console.error("[updater]", e.message);
    sendUpdateStatus({ type: "error", message: e.message });
  });
  // 启动 15 秒后静默检查一次
  setTimeout(() => checkUpdates(false), 15000);
}

async function checkUpdates(manual) {
  try {
    const r = await autoUpdater.checkForUpdates();
    const v = r?.updateInfo?.version;
    if (manual && !v) {
      dialog.showMessageBox(mainWindow, { type: "info", title: "检查更新", message: "当前已是最新版本" });
    }
  } catch (e) {
    if (manual) {
      dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "检查更新失败",
        message: "无法连接更新源（GitHub）",
        detail: `${e.message}\n\n可到 Releases 页手动下载：\nhttps://github.com/SWG92/flowsound/releases`,
        buttons: ["打开 Releases 页", "确定"],
      }).then((r) => {
        if (r.response === 0) shell.openExternal("https://github.com/SWG92/flowsound/releases");
      });
    }
  }
}

// ============ IPC ============

ipcMain.handle("check-for-updates", () => checkUpdates(true));
ipcMain.handle("app-version", () => app.getVersion());

ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-max-toggle", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window-close", () => {
  if (closeAction === "exit") {
    quitting = true;
    app.quit();
  } else {
    mainWindow?.hide();
  }
});
ipcMain.on("set-close-action", (_e, a) => {
  if (a === "tray" || a === "exit") closeAction = a;
});
ipcMain.on("set-progress", (_e, v) => {
  if (mainWindow && !mainWindow.isDestroyed() && typeof v === "number") {
    mainWindow.setProgressBar(v); // -1 移除，0~1 显示
  }
});
ipcMain.on("set-tray-state", (_e, s) => updateTrayState(s));
ipcMain.on("open-lyrics", () => openLyricsWindow());
ipcMain.on("lyrics-click-through", (_e, on) => {
  if (lyricsWin && !lyricsWin.isDestroyed()) {
    lyricsWin.setIgnoreMouseEvents(!!on, { forward: !!on });
  }
});
ipcMain.on("set-lyrics-pinned", (_e, on) => {
  if (lyricsWin && !lyricsWin.isDestroyed()) {
    lyricsWin.setAlwaysOnTop(!!on);
  }
});

// 右下角 grip 缩放（FloatLyrics 同款：主进程从 startBounds + 屏幕坐标差计算，无累积漂移）
ipcMain.on("lyrics-resize-start", (event, screenX, screenY) => {
  if (!lyricsWin || event.sender !== lyricsWin.webContents || !Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
  overlayResize = { startBounds: lyricsWin.getBounds(), startX: screenX, startY: screenY };
});
ipcMain.on("lyrics-resize", (event, screenX, screenY) => {
  if (!lyricsWin || !overlayResize || event.sender !== lyricsWin.webContents || !Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
  const { startBounds, startX, startY } = overlayResize;
  const display = screen.getDisplayMatching(startBounds);
  const maxW = Math.max(LYRICS_MIN.width, startBounds.width, display.workArea.x + display.workArea.width - startBounds.x);
  const maxH = Math.max(LYRICS_MIN.height, startBounds.height, display.workArea.y + display.workArea.height - startBounds.y);
  const width = Math.min(maxW, Math.max(LYRICS_MIN.width, Math.round(startBounds.width + screenX - startX)));
  const height = Math.min(maxH, Math.max(LYRICS_MIN.height, Math.round(startBounds.height + screenY - startY)));
  lyricsWin.setBounds({ ...startBounds, width, height }, false);
});
ipcMain.on("lyrics-resize-end", () => {
  overlayResize = null;
});

// ============ 生命周期 ============

app.on("second-instance", showWindow);

app.whenReady().then(async () => {
  createTray();
  try {
    await startServer();
  } catch (e) {
    dialog.showErrorBox("FlowSound 启动失败", String(e.message || e));
    app.quit();
    return;
  }
  createWindow();
  registerMediaKeys();
  if (app.isPackaged) setupAutoUpdater();
});

app.on("before-quit", () => {
  quitting = true;
  if (lyricsWin && !lyricsWin.isDestroyed()) lyricsWin.destroy();
});
app.on("quit", () => {
  serverProc?.kill();
  globalShortcut.unregisterAll();
});

// 托盘常驻模式下，窗口全关 ≠ 退出
app.on("window-all-closed", () => {
  if (quitting) app.quit();
});

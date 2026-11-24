// FlowSound Electron 主进程
// 职责：启动内嵌 Next.js standalone 服务器 → 创建无框主窗口（自绘标题栏）→
//       托盘常驻（播放态图标/tooltip）→ 全局媒体键 →
//       任务栏进度条 → 软件内自动更新（electron-updater + GitHub Releases）
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, dialog, shell, nativeImage, screen, session } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");
const fs = require("fs");

// 系统证书链含拦截证书时，Node TLS（更新器/GitHub 访问）会报"unable to verify
// the first certificate"——改用系统 CA 验证即可正常访问 GitHub 更新源
app.commandLine.appendSwitch("use-system-ca");

const BASE_PORT = 37120;      // 内嵌服务器起始端口（避开常用 3000，冲突自动 +1 重试）
const PORT_RETRY = 20;
// 用户启动 FlowSound.exe --insecure 时启用（仅在系统证书链异常时用，默认保持 TLS 校验）
const INSECURE_TLS = process.argv.includes("--insecure");

let serverProc = null;
let serverPort = 0;
let mainWindow = null;
let splashWin = null;
let splashShownAt = 0;
let tray = null;
let quitting = false;
let closeAction = "tray";     // 关闭按钮行为：tray=最小化到托盘 / exit=直接退出（设置页可改）
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
// 用户机器无需安装 Node。系统证书链拦截上游音乐接口的自签名证书时，可通过:
// ① 命令行启动 FlowSound.exe 时追加 --insecure 参数（已在下方解析并回退 NODE_TLS_REJECT_UNAUTHORIZED=0）
// ② 或单独运行 npm run start:insecure（仅限本地调试）
function spawnServer(serverDir, port, insecure = false) {
  const entry = path.join(serverDir, "server.js");
  if (!fs.existsSync(entry)) return null;
  const baseEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
  };
  if (insecure) baseEnv.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const proc = spawn(process.execPath, [entry], {
    cwd: serverDir,
    env: baseEnv,
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
      serverProc = spawnServer(dir, p, INSECURE_TLS);
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

// ============ 启动屏（进场动画）============

// 覆盖内嵌服务器启动 + 首屏加载的空白期：双击图标立刻看到品牌进场动画，
// 主窗口首次绘制完成后无缝交接。最短展示 600ms，避免就绪太快时闪一下。
const SPLASH_MIN_MS = 600;

function createSplash() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "build", "icon.png");
  splashWin = new BrowserWindow({
    width: 440,
    height: 320,
    frame: false,
    transparent: true,          // 圆角卡片直接浮在桌面壁纸前
    resizable: false,
    movable: true,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: { sandbox: true, preload: path.join(__dirname, "preload-splash.cjs") },
  });
  splashWin.on("closed", () => { splashWin = null; });
  splashWin.once("ready-to-show", () => {
    splashShownAt = Date.now();
    splashWin?.show();
    splashWin?.focus();
  });
  splashWin.loadFile(path.join(__dirname, "splash.html"), {
    search: `icon=${encodeURIComponent(iconPath)}`,
  });
}

// 启动屏点击跳过：冷启动首绘迟迟不来时可手动放行
ipcMain.on("splash:skip", () => {
  if (!splashWin) return;
  closeSplash();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
});

function closeSplash() {
  if (!splashWin || splashWin.isDestroyed()) {
    splashWin = null;
    return;
  }
  const win = splashWin;
  splashWin = null;
  const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - splashShownAt));
  setTimeout(() => {
    try { win.close(); } catch { /* ignore */ }
  }, wait);
}

// ============ 主窗口（无框 + 自绘标题栏）============

function resIcon(file) {
  const dir = app.isPackaged ? process.resourcesPath : path.join(__dirname, "build");
  return nativeImage.createFromPath(path.join(dir, file));
}

function appIcon() {
  return resIcon("icon.png");
}

// ============ 窗口状态记忆 ============
// 记住上次关闭时的窗口大小/位置/最大化，下次启动还原（外接显示器拔掉、
// 分辨率变化时自动回退默认，避免窗口"消失在屏幕外"）。全屏不记录——
// 误触全屏后退出，下次还是恢复成窗口更符合直觉。
const WINDOW_STATE_FILE = () => path.join(app.getPath("userData"), "window-state.json");

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(WINDOW_STATE_FILE(), "utf8"));
    if (!Number.isFinite(s.width) || !Number.isFinite(s.height)) return null;
    if (s.width < 380 || s.height < 600) return null; // 低于最小尺寸视为脏数据
    const ok = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return s.x >= a.x - 60 && s.y >= a.y - 60 && s.x < a.x + a.width && s.y < a.y + a.height;
    });
    return ok ? s : null;
  } catch {
    return null;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
  if (mainWindow.isFullScreen()) return; // 全屏尺寸不记，保留最后一次窗口态
  try {
    fs.writeFileSync(WINDOW_STATE_FILE(), JSON.stringify({
      ...mainWindow.getBounds(),
      maximized: mainWindow.isMaximized(),
    }));
  } catch { /* ignore */ }
}

let windowStateTimer = null;
function queueSaveWindowState() {
  if (windowStateTimer) clearTimeout(windowStateTimer);
  windowStateTimer = setTimeout(saveWindowState, 300); // resize/move 高频触发，防抖落盘
}

function createWindow() {
  const saved = loadWindowState();
  mainWindow = new BrowserWindow({
    width: saved?.width ?? 1200,
    height: saved?.height ?? 800,
    x: saved?.x,                // 无记录时 undefined → Electron 自动居中
    y: saved?.y,
    minWidth: 380,
    minHeight: 600,
    frame: false,              // 无框：标题栏由渲染层 DesktopTitleBar 自绘（汽水音乐同款集成式）
    backgroundColor: "#0b0b12",
    autoHideMenuBar: true,
    show: false,
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      // 默认节流即可：音频播放由 Howler 驱动不受影响；隐藏到托盘时
      // 定时器/渲染降频反而省 CPU（桌面歌词功能已移除，无实时同步需求）
    },
  });
  if (saved?.maximized) mainWindow.maximize(); // 在 show 之前最大化，避免闪一帧小窗

  mainWindow.once("ready-to-show", () => {
    closeSplash();
    mainWindow.show();
  });
  // 兜底：冷启动首绘缓慢时 ready-to-show 可能迟迟不来，启动屏会一直盖着——
  // 加载完成（稍候一拍等首绘）/加载失败/15s 硬超时 三条路径都会关闭启动屏并亮出主窗
  mainWindow.webContents.on("did-finish-load", () => setTimeout(() => closeSplash(), 300));
  mainWindow.webContents.on("did-fail-load", () => closeSplash());
  setTimeout(() => {
    if (!splashWin) return;
    closeSplash();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  }, 15000);
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  // 窗口状态记忆：尺寸/位置变化防抖落盘
  mainWindow.on("resize", queueSaveWindowState);
  mainWindow.on("move", queueSaveWindowState);
  mainWindow.on("maximize", queueSaveWindowState);
  mainWindow.on("unmaximize", queueSaveWindowState);

  // 关闭按钮行为由设置决定：tray=最小化到托盘 / exit=直接退出
  mainWindow.on("close", (e) => {
    if (quitting || closeAction === "exit") {
      quitting = true;
      saveWindowState(); // 退出路径同步落盘，保证状态不丢
      return;
    }
    e.preventDefault();
    mainWindow.hide();
  });

  // 站外链接一律走系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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

function buildTrayMenu() {
  if (!tray) return;
  const items = [
    { label: "显示主界面", click: showWindow },
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
  ];
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function createTray() {
  tray = new Tray(trayIconFor(false));
  tray.setToolTip("FlowSound — 让音乐流动起来");
  buildTrayMenu();
  tray.on("double-click", showWindow);
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
  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateStatus({ type: "downloaded", version: info.version });
    try {
      tray?.displayBalloon({
        iconType: "info",
        title: "FlowSound 更新就绪",
        content: `v${info.version} 已下载完成，到 设置→桌面版 点击「重启并更新」`,
      });
    } catch { /* 非 Windows 忽略 */ }
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
    // 同版本 → 回传"已是最新"状态（设置页内联展示）；新版本 → update-available 事件自动流转下载
    if (manual && (!v || v === app.getVersion())) {
      sendUpdateStatus({ type: "up-to-date", version: app.getVersion() });
    }
  } catch (e) {
    if (manual) sendUpdateStatus({ type: "error", message: String(e.message || e) });
    console.error("[updater]", e.message);
  }
}

// ============ IPC ============

ipcMain.handle("check-for-updates", () => checkUpdates(true));
ipcMain.handle("app-version", () => app.getVersion());
ipcMain.on("quit-and-install", () => {
  quitting = true;
  autoUpdater.quitAndInstall();
});

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

// 清理磁盘缓存：Chromium HTTP 磁盘缓存（封面图/字体/接口临时副本，增长大头）
// + 软件内更新遗留的安装包副本。收藏/历史等 Local Storage 用户数据不受影响。
ipcMain.handle("clear-disk-cache", async () => {
  try {
    await session.defaultSession.clearCache();
    try {
      const updaterDir = path.join(process.env.LOCALAPPDATA || "", `${app.getName()}-updater`);
      const files = await fs.promises.readdir(updaterDir).catch(() => []);
      for (const f of files) {
        if (/\.exe$/i.test(f)) {
          await fs.promises.rm(path.join(updaterDir, f), { force: true }).catch(() => {});
        }
      }
    } catch { /* 更新缓存目录不存在属正常 */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
});



// ============ 生命周期 ============

app.on("second-instance", showWindow);

app.whenReady().then(async () => {
  // 清 HTTP 缓存：安装新版本后，缓存的旧 HTML 会引用旧 chunk（extraResources
  // 目录合并不清旧文件），界面会一直跑旧代码——每次启动清一次，保证渲染最新版
  try {
    await session.defaultSession.clearCache();
  } catch { /* ignore */ }

  createSplash();             // 启动屏先行：立刻有画面，盖住服务器启动的空白期
  createTray();
  try {
    await startServer();
  } catch (e) {
    closeSplash();
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
  saveWindowState(); // 托盘"退出"/快捷键退出等所有路径都补一次落盘
});
app.on("quit", () => {
  serverProc?.kill();
  globalShortcut.unregisterAll();
});

// 托盘常驻模式下，窗口全关 ≠ 退出
app.on("window-all-closed", () => {
  if (quitting) app.quit();
});

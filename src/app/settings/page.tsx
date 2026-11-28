"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Monitor, Laptop, Database, Sun, Moon, Download, Upload, RefreshCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDesktop } from "@/lib/desktop";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { APP_INFO, PERFORMANCE_KEY } from "@/lib/constants";
import { clearApiCache } from "@/lib/api";

// 清除缓存时保留的键：全部用户数据与偏好设置。
// 只有真正的缓存（每日推荐、内存接口缓存、Service Worker 离线资源）会被清掉。
const PRESERVE_KEYS = [
  // 用户数据
  "flowsound_favorite_songs",
  "flowsound_history",
  "flowsound_playlists",
  "flowsound_blacklist",
  "flowsound_blacklist_songs",
  "flowsound_play_counts",
  "fc_likes",
  // 偏好设置
  "flowsound_theme",
  "flowsound_theme_preset",
  "flowsound_audio_quality",
  "flowsound_volume",
  "flowsound_play_mode",
  "flowsound_speed",
  "flowsound_search_history",
  "flowsound_eq_settings",
  "flowsound_eq_preset",
  "flowsound_eq_enabled",
  "flowsound_lyric_color",
  "flowsound_lyrics_pos",
  // 播放恢复现场与功能偏好（清缓存不应误伤）
  "flowsound_pb_static",
  "flowsound_pb_live",
  "flowsound_roaming_genre",
  "flowsound_close_action",
  "flowsound_performance",
];
// 动态键（本地评论按歌曲 ID 存储：fc_<songId>）
const PRESERVE_PREFIXES = ["fc_"];

// 备份涵盖的用户数据键（歌单/收藏/黑名单/播放记录/播放次数）
const BACKUP_DATA_KEYS = [
  "flowsound_playlists",
  "flowsound_favorite_songs",
  "flowsound_blacklist_songs",
  "flowsound_history",
  "flowsound_play_counts",
];

// 备份文件结构标记
const BACKUP_MAGIC = "flowsound-backup";

// 主题色预设（与 store 的 ThemePreset 对应；dot 为设置页色板小圆点的渐变）
const THEME_PRESETS: { id: "aurora" | "sunset" | "ocean"; label: string; dot: string }[] = [
  { id: "aurora", label: "治愈紫", dot: "linear-gradient(135deg, oklch(0.62 0.14 280), oklch(0.62 0.1 330))" },
  { id: "sunset", label: "治愈橙", dot: "linear-gradient(135deg, oklch(0.62 0.14 55), oklch(0.62 0.1 25))" },
  { id: "ocean", label: "科技蓝", dot: "linear-gradient(135deg, oklch(0.62 0.14 255), oklch(0.62 0.1 200))" },
];

/** 设置分组：安静的小标题 + 玻璃卡片（与全局材质一致，分组靠行分隔线表达） */
function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-widest text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** 统一设置行：左侧标题+描述、右侧控件（黄金法则：一致性——所有行同一节奏） */
function Row({ title, desc, children, first }: { title: string; desc?: string; children: ReactNode; first?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3.5", !first && "border-t border-border/40")}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const theme = usePlayerStore((s) => s.theme);
  const setTheme = usePlayerStore((s) => s.setTheme);
  const themePreset = usePlayerStore((s) => s.themePreset);
  const setThemePreset = usePlayerStore((s) => s.setThemePreset);
  // 歌词翻译开关（持久化，全屏页/歌词弹窗/悬浮歌词共享同源状态）
  const { showToast } = useToast();
  // 音质等偏好存在 localStorage，服务端渲染时只能拿到默认值；
  // 挂载后再显示客户端状态，避免 hydration 不匹配（异步置位以满足 set-state-in-effect 规则）
  const [mounted, setMounted] = useState(false);
  const [performanceOn, setPerformanceOn] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  // 桌面壳（Electron）专属：版本显示 / 检查更新 / 关闭行为偏好
  const [deskVersion, setDeskVersion] = useState<string | null>(null);
  const [updateMsg, setUpdateMsg] = useState("");
  const [updateReady, setUpdateReady] = useState(false);
  const [closeAction, setCloseActionState] = useState<"tray" | "exit">("tray");
  useEffect(() => {
    const d = getDesktop();
    if (!d) return;
    d.getAppVersion?.().then((v) => setDeskVersion(v)).catch(() => {});
    // 用 ref 捕获最新 deskVersion，避免 effect 依赖数组里频繁重挂 onUpdateStatus
    let deskVersionRef: string | null = null;
    const unsubUpdate = d.onUpdateStatus?.((s) => {
      if (s.type === "checking") setUpdateMsg("正在检查更新…");
      else if (s.type === "up-to-date") setUpdateMsg(`已是最新版本 v${s.version ?? deskVersionRef ?? ""}`);
      else if (s.type === "available") setUpdateMsg(`发现新版本 v${s.version}，正在后台下载…`);
      else if (s.type === "progress") setUpdateMsg(`下载新版本 ${s.percent ?? 0}%`);
      else if (s.type === "downloaded") { setUpdateMsg(`v${s.version} 已就绪`); setUpdateReady(true); }
      else if (s.type === "error") setUpdateMsg("更新失败，可稍后重试或到 GitHub Releases 手动下载");
    });
    // 版本号就绪后更新 ref（onUpdateStatus 回调里用）
    d.getAppVersion?.().then((v) => { deskVersionRef = v; }).catch(() => {});
    // 本地偏好延后一拍再同步：effect 内同步 setState 会触发级联渲染（React Compiler 规则）
    const t = setTimeout(() => {
      try {
        setCloseActionState(localStorage.getItem("flowsound_close_action") === "exit" ? "exit" : "tray");
      } catch { /* ignore */ }
    }, 0);
    return () => { clearTimeout(t); unsubUpdate?.(); };
  }, []);

  const handleCheckUpdate = () => {
    setUpdateMsg("正在检查更新…");
    setUpdateReady(false);
    getDesktop()?.checkForUpdates?.();
  };

  const applyCloseAction = (a: "tray" | "exit") => {
    setCloseActionState(a);
    try { localStorage.setItem("flowsound_close_action", a); } catch { /* ignore */ }
    getDesktop()?.setCloseAction(a);
  };
  useEffect(() => {
    const t = setTimeout(() => {
      setMounted(true);
      setPerformanceOn(localStorage.getItem(PERFORMANCE_KEY) === "1");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const togglePerformance = () => {
    const next = !performanceOn;
    setPerformanceOn(next);
    localStorage.setItem(PERFORMANCE_KEY, next ? "1" : "0");
    document.documentElement.classList.toggle("performance", next);
    showToast(next ? "性能模式已开启" : "性能模式已关闭", "success");
  };

  // 导出用户数据：歌单/收藏/黑名单/播放记录/播放次数 打包为 JSON 文件下载
  const handleExport = () => {
    const data: Record<string, unknown> = {
      magic: BACKUP_MAGIC,
      exportedAt: new Date().toISOString(),
    };
    for (const key of BACKUP_DATA_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `flowsound-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast("备份文件已下载", "success");
  };

  // 导入用户数据：校验文件结构后整体覆盖对应键（导入前自动先导出一份当前数据兜底）
  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.magic !== BACKUP_MAGIC) {
        showToast("文件格式不对，请选择 FlowSound 导出的备份文件", "error");
        return;
      }
      // 导入前自动备份当前数据，防止误导入不可逆
      handleExport();
    } catch {
      showToast("备份文件读取失败，请检查文件", "error");
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      let applied = 0;
      for (const key of BACKUP_DATA_KEYS) {
        if (data[key] !== undefined) {
          localStorage.setItem(key, JSON.stringify(data[key]));
          applied++;
        }
      }
      if (applied === 0) {
        showToast("备份文件里没有可导入的数据", "error");
        return;
      }
      showToast(`已导入 ${applied} 类数据，正在刷新页面…`, "success");
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      showToast("导入失败，文件内容无效", "error");
    }
  };

  const handleClearCache = async () => {
    // 1. 内存中的接口缓存（搜索结果、歌曲地址、歌词等）
    clearApiCache();

    // 2. localStorage：只清缓存类数据，其余（用户数据/偏好）原样保留
    const preserved: Record<string, string> = {};
    const removable: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const isPreserved =
        PRESERVE_KEYS.includes(key) ||
        PRESERVE_PREFIXES.some((p) => key.startsWith(p));
      if (isPreserved) {
        const value = localStorage.getItem(key);
        if (value !== null) preserved[key] = value;
      } else {
        removable.push(key);
      }
    }
    removable.forEach((key) => localStorage.removeItem(key));

    // 3. Service Worker 离线资源缓存
    let swCleared = false;
    try {
      if (typeof caches !== "undefined") {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        swCleared = names.length > 0;
      }
    } catch {
      // 不支持 Cache API 时忽略
    }

    // 4. 桌面壳磁盘缓存（Chromium HTTP 缓存：封面图/字体/接口临时副本 +
    //    更新器遗留安装包）——浏览器环境没有这一层，跳过
    let diskCleared = false;
    const d = getDesktop();
    if (d?.clearDiskCache) {
      try {
        const r = await d.clearDiskCache();
        diskCleared = !!r?.ok;
      } catch {
        // 桌面壳通信失败时忽略，其余缓存已清
      }
    }

    showToast(
      diskCleared
        ? "缓存已清除（含桌面端磁盘缓存，封面图下次自动重建）"
        : swCleared
          ? "缓存已清除（含离线资源）"
          : "缓存已清除",
      "success"
    );
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* 导入用的隐藏文件选择器 */}
      <input
        ref={importFileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
          e.target.value = ""; // 允许重复选择同一文件
        }}
      />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="gradient-text">设置</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">自定义你的音乐体验</p>
      </div>

      <Section icon={Monitor} title="界面">
        <Row first title="主题模式" desc={mounted ? (theme === "dark" ? "当前：深色模式" : "当前：浅色模式") : "主题模式"}>
          <Button
            variant={mounted && theme === "light" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("light")}
            className="cursor-pointer"
          >
            <Sun className="h-4 w-4 mr-1" />
            浅色
          </Button>
          <Button
            variant={mounted && theme === "dark" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("dark")}
            className="cursor-pointer"
          >
            <Moon className="h-4 w-4 mr-1" />
            深色
          </Button>
        </Row>
        <Row title="主题色" desc="治愈紫 / 治愈橙 / 科技蓝——主色、渐变、光斑整套联动，深浅色通用">
          <div className="flex gap-2">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setThemePreset(p.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all border",
                  themePreset === p.id
                    ? "bg-primary/10 text-primary font-medium border-primary/40"
                    : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                )}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full inline-block ring-1 ring-black/10"
                  style={{ background: p.dot }}
                />
                {p.label}
              </button>
            ))}
          </div>
        </Row>
        <Row title="性能模式" desc="关闭背景模糊与光斑动画，低配设备更流畅（玻璃质感会简化）">
          <Button
            variant={mounted && performanceOn ? "default" : "outline"}
            size="sm"
            onClick={togglePerformance}
            className="cursor-pointer"
          >
            {mounted && performanceOn ? "已开启" : "已关闭"}
          </Button>
        </Row>

      </Section>

      <Section icon={Database} title="数据与缓存">
        <Row first title="导出数据" desc="歌单、收藏、黑名单、播放记录打包为 JSON 文件下载，可跨设备迁移">
          <Button variant="outline" size="sm" onClick={handleExport} className="cursor-pointer">
            <Download className="h-4 w-4 mr-1.5" />
            导出
          </Button>
        </Row>
        <Row title="导入数据" desc="从备份文件恢复（导入前会自动备份当前数据，以防误操作）">
          <Button
            variant="outline"
            size="sm"
            onClick={() => importFileRef.current?.click()}
            className="cursor-pointer"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            导入
          </Button>
        </Row>
        <Row title="清除缓存" desc="接口缓存、离线资源与桌面端磁盘缓存（临时副本，下次自动重建）；收藏、歌单等数据完整保留">
          <Button variant="outline" size="sm" onClick={handleClearCache} className="cursor-pointer">
            清除缓存
          </Button>
        </Row>
      </Section>

      {/* 桌面版（仅 Electron 壳内显示） */}
      {deskVersion !== null && (
        <Section icon={Laptop} title="桌面版">
          <Row first title="软件更新" desc={updateMsg || `当前版本 v${deskVersion} · 自动检查新版本，下载完成后提示重启`}>
            {updateReady ? (
              <Button variant="default" size="sm" onClick={() => getDesktop()?.restartForUpdate()} className="cursor-pointer">
                <RefreshCw className="h-4 w-4 mr-1.5" />
                重启并更新
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleCheckUpdate} className="cursor-pointer">
                <RefreshCw className="h-4 w-4 mr-1.5" />
                检查更新
              </Button>
            )}
          </Row>
          <Row title="关闭按钮行为" desc="点窗口 X 时：缩到托盘继续播放，或直接退出应用">
            <div className="flex gap-2">
              <Button
                variant={closeAction === "tray" ? "default" : "outline"}
                size="sm"
                onClick={() => applyCloseAction("tray")}
                className="cursor-pointer"
              >
                缩到托盘
              </Button>
              <Button
                variant={closeAction === "exit" ? "default" : "outline"}
                size="sm"
                onClick={() => applyCloseAction("exit")}
                className="cursor-pointer"
              >
                直接退出
              </Button>
            </div>
          </Row>
        </Section>
      )}

      <p className="px-1 pt-2 text-xs text-muted-foreground/70">
        {APP_INFO.name} · v{APP_INFO.version} · {APP_INFO.tech}
      </p>
    </div>
  );
}

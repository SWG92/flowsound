"use client";

import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Monitor, Database, Info, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { APP_INFO } from "@/lib/constants";
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
];
// 动态键（本地评论按歌曲 ID 存储：fc_<songId>）
const PRESERVE_PREFIXES = ["fc_"];

export default function SettingsPage() {
  const theme = usePlayerStore((s) => s.theme);
  const setTheme = usePlayerStore((s) => s.setTheme);
  const { showToast } = useToast();
  // 音质等偏好存在 localStorage，服务端渲染时只能拿到默认值；
  // 挂载后再显示客户端状态，避免 hydration 不匹配（异步置位以满足 set-state-in-effect 规则）
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

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

    showToast(
      swCleared ? "缓存已清除（含离线资源）" : "缓存已清除",
      "success"
    );
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          <span className="gradient-text">设置</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          自定义你的音乐体验
        </p>
      </div>

      {/* 音频设置：音质选择已移至播放栏（倍速按钮左侧），随时可切 */}

      {/* 界面设置 */}
      <section className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          界面设置
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">主题模式</p>
            {/* 主题存在 localStorage/Cookie，服务端渲染时只有默认值：
                挂载后再显示实际状态，避免 hydration 不匹配（与侧栏做法一致） */}
            <p className="text-xs text-muted-foreground">
              {mounted ? (theme === "dark" ? "当前：深色模式" : "当前：浅色模式") : "主题模式"}
            </p>
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>
      </section>

      {/* 缓存管理 */}
      <section className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          缓存管理
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">清除缓存</p>
            <p className="text-xs text-muted-foreground">
              清理接口缓存、每日推荐与离线资源；收藏、歌单、播放记录、黑名单、本地评论等数据会完整保留
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            className="cursor-pointer"
          >
            清除缓存
          </Button>
        </div>
      </section>

      {/* 关于 */}
      <section className="glass rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          关于
        </h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">应用名称</span>
            <span className="font-medium">{APP_INFO.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">版本</span>
            <span className="font-medium">{APP_INFO.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">技术栈</span>
            <span className="font-medium">{APP_INFO.tech}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

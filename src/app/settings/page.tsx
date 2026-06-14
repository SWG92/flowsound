"use client";

import { Settings as SettingsIcon, Music, Monitor, Database, Info, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { AUDIO_QUALITY, APP_INFO } from "@/lib/constants";
import type { AudioQuality } from "@/lib/constants";

const QUALITY_OPTIONS = Object.entries(AUDIO_QUALITY).map(([key, val]) => ({
  value: key as AudioQuality,
  label: val.label,
  bitrate: val.bitrate,
}));

export default function SettingsPage() {
  const audioQuality = usePlayerStore((s) => s.audioQuality);
  const setAudioQuality = usePlayerStore((s) => s.setAudioQuality);
  const theme = usePlayerStore((s) => s.theme);
  const setTheme = usePlayerStore((s) => s.setTheme);
  const { showToast } = useToast();

  const handleClearCache = () => {
    // 保留收藏、历史、歌单，清除其他缓存
    const keysToKeep = [
      "flowsound_favorite_songs",
      "flowsound_history",
      "flowsound_playlists",
      "flowsound_theme",
      "flowsound_audio_quality",
      "flowsound_volume",
      "flowsound_play_mode",
      "flowsound_speed",
    ];

    const preserved: Record<string, string> = {};
    keysToKeep.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value) preserved[key] = value;
    });

    localStorage.clear();

    Object.entries(preserved).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });

    showToast("缓存已清除", "success");
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

      {/* 音频设置 */}
      <section className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          音频设置
        </h2>

        <div>
          <p className="text-sm text-muted-foreground mb-3">音质选择</p>
          <div className="grid grid-cols-2 gap-2">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setAudioQuality(opt.value);
                  showToast(`已切换至 ${opt.label}`, "success");
                }}
                className={`flex flex-col items-center p-3 rounded-lg border transition-all cursor-pointer ${
                  audioQuality === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className="font-medium text-sm">{opt.label}</span>
                <span className="text-xs text-muted-foreground">
                  {opt.bitrate === "999000" ? "无损" : `${parseInt(opt.bitrate) / 1000}kbps`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 界面设置 */}
      <section className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          界面设置
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">主题模式</p>
            <p className="text-xs text-muted-foreground">
              {theme === "dark" ? "当前：深色模式" : "当前：浅色模式"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
              className="cursor-pointer"
            >
              <Sun className="h-4 w-4 mr-1" />
              浅色
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
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
              将保留收藏、歌单、播放历史等数据
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

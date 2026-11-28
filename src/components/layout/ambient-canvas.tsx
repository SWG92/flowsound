"use client";

import { usePlayerStore, type ThemePreset } from "@/lib/store";
import FlowCanvas from "@/components/player/flow-canvas";

/** 主题色预设 → 环境层主色（与 globals.css 预设的 --theme-hue-a 同族） */
const TINT: Record<ThemePreset, string> = {
  aurora: "#8b7ff0", // 治愈紫
  sunset: "#e0a060", // 治愈橙
  ocean: "#5f8bff", // 科技蓝
};

/**
 * 全局环境声浪层：贴在应用渐变背景之上、所有内容之下。
 * 粒子/流场颜色跟随主题预设（不与主题渐变打架）；
 * 有音乐时整个应用随流场呼吸，无播放时缓慢漂移；
 * 性能模式自动休眠（FlowCanvas 内建）。
 */
export function AmbientCanvas() {
  const preset = usePlayerStore((s) => s.themePreset);
  return (
    <FlowCanvas
      accent={TINT[preset] ?? TINT.aurora}
      className="absolute inset-0 -z-10 pointer-events-none opacity-80"
    />
  );
}

"use client";

import FlowCanvas from "@/components/player/flow-canvas";

/**
 * 全局环境声浪层：贴在应用渐变背景之上、所有内容之下。
 * 有音乐时整个应用随流场呼吸（面板磨砂会把它柔化成"会流动的光"），
 * 无播放时缓慢漂移——"让音乐流动起来"的全局点题。
 * 性能模式自动休眠（FlowCanvas 内建）。
 */
export function AmbientCanvas() {
  return (
    <FlowCanvas
      accent={null}
      className="absolute inset-0 -z-10 pointer-events-none opacity-80"
    />
  );
}

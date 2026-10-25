"use client";

import { useEffect, useState } from "react";

// 取色结果缓存：切回同一首歌不重复计算（页面内 Map，会话级）
const colorCache = new Map<string, string>();

/**
 * 从封面图提取主色（Material You / YouTube Music 式动态取色）。
 * 做法：16x16 缩略绘制 → 按色相分桶 → 取出现频次最高且足够鲜艳的桶的加权平均，
 * 再适度提亮提饱和，保证深色背景上可读。取色失败（跨域受限等）返回 null，调用方降级。
 */
export function useDominantColor(coverUrl: string | undefined | null): string | null {
  const [color, setColor] = useState<string | null>(() =>
    coverUrl ? colorCache.get(coverUrl) ?? null : null
  );

  useEffect(() => {
    if (!coverUrl) {
      const t = setTimeout(() => setColor(null), 0);
      return () => clearTimeout(t);
    }
    const cached = colorCache.get(coverUrl);
    if (cached) {
      const t = setTimeout(() => setColor(cached), 0);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = coverUrl + "?param=64x64";

    const fail = () => {
      if (!cancelled) setColor(null);
    };

    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 16;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return fail();
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // 按色相 12° 一桶统计（只统计饱和度达标的像素，避免灰白噪点主导）
        const buckets = new Map<number, { r: number; g: number; b: number; n: number; weight: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const lightness = (max + min) / 510;
          const saturation = max === min ? 0 : (max - min) / max;
          // 过滤过暗/过亮/发灰的像素
          if (lightness < 0.12 || lightness > 0.94 || saturation < 0.25) continue;

          let h = 0;
          const d = max - min;
          if (d === 0) h = 0;
          else if (max === r) h = ((g - b) / d) % 6;
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h = ((h * 60) % 360 + 360) % 360;

          const bucket = Math.floor(h / 12);
          const weight = saturation; // 越鲜艳权重越高
          const cur = buckets.get(bucket) ?? { r: 0, g: 0, b: 0, n: 0, weight: 0 };
          cur.r += r * weight;
          cur.g += g * weight;
          cur.b += b * weight;
          cur.n += 1;
          cur.weight += weight;
          buckets.set(bucket, cur);
        }

        if (buckets.size === 0) return fail();
        // 取权重最高的桶，转 HSL 后提亮到 0.62~0.68、饱和拉到 0.6~0.85：深色背景上柔和可读
        const best = [...buckets.values()].sort((a, b) => b.weight - a.weight)[0];
        const [hue] = rgbToHsl(
          Math.round(best.r / best.weight),
          Math.round(best.g / best.weight),
          Math.round(best.b / best.weight)
        );
        const sat = 0.68;
        const light = 0.65;
        const rgb = hslToRgb2(hue, sat, light);
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);

        colorCache.set(coverUrl, hex);
        if (!cancelled) setColor(hex);
      } catch {
        // 图片 CDN 不带 CORS 头时 getImageData 会抛异常，降级为默认配色
        fail();
      }
    };
    img.onerror = fail;

    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  return color;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h = ((h * 60) % 360 + 360) % 360;
  }
  return [h, s, l];
}

function hslToRgb2(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

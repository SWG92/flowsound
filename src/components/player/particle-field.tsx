"use client";

import { useEffect, useRef } from "react";
import { getAnalyser } from "@/lib/equalizer";
import { PERFORMANCE_KEY } from "@/lib/constants";

/**
 * 粒子光影场（Mineradio 式）：2D Canvas 粒子系统。
 * 深空底 + 数百颗专辑色发光粒子按流场漂移，帧间半透明覆盖形成拖尾；
 * 低频能量驱动粒子速度与亮度（鼓点推涌），无播放时缓慢呼吸。
 * 零依赖、单 canvas、DPR 上限 1.5——GPU/CPU 开销可忽略；
 * 性能模式（PERFORMANCE_KEY=1）自动休眠，标签页隐藏暂停。
 */

function hexToRgb(hex: string | null): [number, number, number] {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return [0.62, 0.55, 0.95];
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function lighten([r, g, b]: [number, number, number], k = 0.5): [number, number, number] {
  const lift = (c: number) => Math.min(1, c * (1 - k) + k);
  return [lift(r), lift(g), lift(b)];
}

/** 64px 径向渐变光粒贴图（中心实、边缘发散） */
function makeSprite(rgb: [number, number, number]): HTMLCanvasElement {
  const s = document.createElement("canvas");
  s.width = s.height = 64;
  const g = s.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb.map((c) => Math.round(c * 255)).join(",")},1)`);
  grad.addColorStop(0.35, `rgba(${rgb.map((c) => Math.round(c * 255)).join(",")},0.5)`);
  grad.addColorStop(1, `rgba(${rgb.map((c) => Math.round(c * 255)).join(",")},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return s;
}

const DEEP = "rgba(3,6,14,0.16)"; // 深空底色（帧间低透明覆盖 → 拖尾）

export default function ParticleField({ accent, className }: { accent: string | null; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accentRef = useRef<string | null>(accent);

  useEffect(() => {
    accentRef.current = accent;
  }, [accent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let sprites: HTMLCanvasElement[] = [];
    let lastAccent: string | null = null;
    const rebuildSprites = () => {
      const base = hexToRgb(accentRef.current);
      sprites = [base, lighten(base), lighten(base, 0.85)].map(makeSprite);
      lastAccent = accentRef.current;
    };
    rebuildSprites();

    type P = { x: number; y: number; vx: number; vy: number; r: number; spr: number; ph: number; sp: number };
    let parts: P[] = [];
    let w = 0, h = 0;

    const seed = () => {
      w = canvas.clientWidth || 1;
      h = canvas.clientHeight || 1;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(w * dpr * 0.75));
      canvas.height = Math.max(1, Math.round(h * dpr * 0.75));
      ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
      ctx.fillStyle = "#03060e";
      ctx.fillRect(0, 0, w, h);
      const n = Math.min(240, Math.round((w * h) / 8000));
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: 1.6 + Math.random() * 5.2,
        spr: Math.floor(Math.random() * 3),
        ph: Math.random() * Math.PI * 2,
        sp: 0.5 + Math.random() * 0.9,
      }));
    };
    seed();

    let raf = 0;
    let running = true;
    let frame = 0;
    let bass = 0, mid = 0, t = 0;
    let spec = new Uint8Array(64);
    const start = performance.now();

    const render = (now: number) => {
      if (!running) return;
      frame++;
      if (frame % 30 === 0 && localStorage.getItem(PERFORMANCE_KEY) === "1") {
        running = false;
        return;
      }
      // 专辑主色变化 → 重建光粒贴图
      if (accentRef.current !== lastAccent) rebuildSprites();

      const an = getAnalyser();
      if (an && an.frequencyBinCount > 0) {
        if (spec.length !== an.frequencyBinCount) spec = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(spec);
        const avg = (from: number, to: number) => {
          let s = 0, n = 0;
          for (let i = from; i < Math.min(to, spec.length); i++) { s += spec[i]; n++; }
          return n ? s / n / 255 : 0;
        };
        bass += (avg(1, 8) - bass) * 0.12;
        mid += (avg(8, 40) - mid) * 0.12;
      } else {
        bass *= 0.96;
        mid *= 0.96;
      }

      if (frame % 20 === 0) {
        const nw = canvas.clientWidth || w, nh = canvas.clientHeight || h;
        if (nw !== w || nh !== h) seed();
      }

      // 拖尾：帧间低透明深空覆盖（不清屏）
      t += 0.006 + bass * 0.014;
      ctx.fillStyle = DEEP;
      ctx.fillRect(0, 0, w, h);

      const speed = 0.55 + bass * 2.4;
      for (const p of parts) {
        // 伪 curl 流场导向 + 鼓点推涌
        const a = Math.sin(p.x * 0.0022 + t * 2.1) + Math.cos(p.y * 0.0026 - t * 1.7);
        p.vx += Math.cos(a * 3) * 0.022 * speed;
        p.vy += Math.sin(a * 3) * 0.022 * speed;
        p.vx *= 0.986;
        p.vy *= 0.986;
        p.x += p.vx * speed * p.sp * 2.2;
        p.y += p.vy * speed * p.sp * 2.2;
        if (p.x < -24) p.x = w + 24;
        if (p.x > w + 24) p.x = -24;
        if (p.y < -24) p.y = h + 24;
        if (p.y > h + 24) p.y = -24;

        const tw = 0.55 + 0.45 * Math.sin(t * 9 + p.ph);
        const size = p.r * (3.4 + bass * 2.6);
        ctx.globalAlpha = Math.min(1, tw * (0.5 + bass * 0.9 + mid * 0.3));
        ctx.drawImage(sprites[p.spr % sprites.length], p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

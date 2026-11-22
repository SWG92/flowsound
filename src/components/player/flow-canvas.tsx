"use client";

import { useEffect, useRef } from "react";
import { getAnalyser } from "@/lib/equalizer";
import { PERFORMANCE_KEY } from "@/lib/constants";

/**
 * 声浪流场（全屏播放页背景层）：原生 WebGL 片元着色器渲染的音频驱动流场。
 * 不引入 three.js——单 pass、半分辨率渲染，GPU 开销可忽略；
 * 性能模式（PERFORMANCE_KEY=1）下自动休眠，标签页隐藏时暂停。
 * 数据源：EQ 链上的 AnalyserNode（与频谱条同源）；未播放时能量衰减为 0，流场缓慢呼吸。
 * 配色：专辑主色（accent）为主、向白偏移的高光为副——在玻璃质感上做"会流动的极光"。
 *
 * 初始化时序：全屏页进场动画期间 GPU 光栅繁忙，立即创建 WebGL 上下文可能拿到
 * 立即丢失的上下文（createShader 返回 null）——延后一拍创建，失败按退避重试 3 次。
 */

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform vec3 u_colA;
uniform vec3 u_colB;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = (gl_FragCoord.xy / u_res.y) * 2.2;
  float t = u_time * (0.06 + u_bass * 0.12);
  // 二次域扭曲：制造卷曲流动的丝带感
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t * 0.8));
  vec2 r = vec2(
    fbm(p + 1.6 * q + vec2(1.7, 9.2) + u_bass * 0.6),
    fbm(p + 1.6 * q + vec2(8.3, 2.8) - u_mid * 0.4)
  );
  float f = fbm(p + 1.8 * r);
  vec3 col = mix(u_colA, u_colB, smoothstep(0.28, 0.72, f));
  float glow = (0.3 + 0.7 * f) * (0.5 + u_bass * 0.55 + u_mid * 0.25);
  float a = clamp(glow, 0.0, 1.0) * 0.8;
  gl_FragColor = vec4(col * glow, a);
}
`;

function hexToRgb(hex: string | null): [number, number, number] {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return [0.58, 0.5, 0.9];
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

/** 深色主色提亮为高光副色：向白偏移并拉满亮度下限 */
function lighten([r, g, b]: [number, number, number], k = 0.55): [number, number, number] {
  const lift = (c: number) => Math.min(1, c * (1 - k) + k);
  return [lift(r), lift(g), lift(b)];
}

/** 创建上下文+编译+启动渲染循环；成功返回停止函数，失败返回 null（由调用方重试） */
function initGl(canvas: HTMLCanvasElement, getAccent: () => string | null): (() => void) | null {
  const gl = canvas.getContext("webgl", {
    alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true,
  });
  if (!gl || gl.isContextLost()) return null;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh || gl.isContextLost()) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  // 全屏三角形
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uBass = gl.getUniformLocation(prog, "u_bass");
  const uMid = gl.getUniformLocation(prog, "u_mid");
  const uColA = gl.getUniformLocation(prog, "u_colA");
  const uColB = gl.getUniformLocation(prog, "u_colB");

  let raf = 0;
  let running = true;
  let bass = 0, mid = 0, frame = 0;
  let spec = new Uint8Array(64);
  const start = performance.now();

  const render = (now: number) => {
    if (!running) return;
    frame++;
    // 性能模式：每 30 帧查一次开关，开启即休眠
    if (frame % 30 === 0 && localStorage.getItem(PERFORMANCE_KEY) === "1") {
      running = false;
      return;
    }
    // 能量提取：低频段=鼓点，中频段=人声；无分析节点（未播放）时缓慢衰减
    const an = getAnalyser();
    if (an && an.frequencyBinCount > 0) {
      if (spec.length !== an.frequencyBinCount) spec = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(spec);
      const avg = (from: number, to: number) => {
        let s = 0, n = 0;
        for (let i = from; i < Math.min(to, spec.length); i++) { s += spec[i]; n++; }
        return n ? s / n / 255 : 0;
      };
      bass += (avg(1, 8) - bass) * 0.15;
      mid += (avg(8, 40) - mid) * 0.15;
    } else {
      bass *= 0.95;
      mid *= 0.95;
    }

    // 半分辨率渲染（CSS 放大自带柔化，玻璃质感更融）
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const tw = Math.max(1, Math.round((w / 2) || 1)), th = Math.max(1, Math.round((h / 2) || 1));
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw;
      canvas.height = th;
      gl.viewport(0, 0, tw, th);
    }

    const colA = hexToRgb(getAccent());
    const colB = lighten(colA);
    gl.uniform2f(uRes, tw, th);
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform1f(uBass, bass);
    gl.uniform1f(uMid, mid);
    gl.uniform3f(uColA, colA[0], colA[1], colA[2]);
    gl.uniform3f(uColB, colB[0], colB[1], colB[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
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
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}

export default function FlowCanvas({ accent, className }: { accent: string | null; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accentRef = useRef(accent);
  accentRef.current = accent;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stop: (() => void) | null = null;
    let tries = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const attempt = () => {
      if (cancelled || stop) return;
      tries++;
      canvas.dataset.flow = "try" + tries;
      stop = initGl(canvas, () => accentRef.current);
      if (stop) {
        canvas.dataset.flow = "on";
        return;
      }
      if (tries < 4) {
        timer = setTimeout(attempt, 400 * tries); // 退避重试：400/800/1200ms
      } else {
        canvas.dataset.flow = "failed";
        console.error("[flow] 多次初始化失败，流场不可用（背景回退为模糊封面）");
      }
    };
    // 延后一拍：等全屏页进场动画/大 DOM 变更结束再创建上下文
    timer = setTimeout(attempt, 350);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stop?.();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

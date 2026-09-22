"use client";

import type { Howl } from "howler";
import type { EQBand } from "./eq-store";

// Web Audio EQ 引擎。
//
// 关键约束：
// 1. createMediaElementSource 对同一个音频元素只能调用一次 —— 每首歌是新元素，
//    因此每次切歌都要重建 source；旧元素被 Howler unload 后其节点直接丢弃。
// 2. 一旦元素被 MediaElementSourceNode 捕获，其输出就永远走 Web Audio 图。
//    所以"关闭 EQ"不能断开 source，而是把 source 直连 destination 旁路 EQ 链，
//    否则会直接静音。
// 3. 跨域无 CORS 的音源（部分平台 CDN）经过 Web Audio 会输出静音 ——
//    由 audio-player.ts 的静音看门狗检测并自动回退，本模块只负责建图。

let audioContext: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let filterNodes: BiquadFilterNode[] = [];
let analyserNode: AnalyserNode | null = null;
let connectedEl: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioContext || audioContext.state === "closed") {
    try {
      audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function getAudioElement(howl: Howl): HTMLAudioElement | null {
  try {
    const sounds = (
      howl as unknown as { _sounds: { _node: HTMLAudioElement }[] }
    )._sounds;
    if (sounds && sounds.length > 0 && sounds[0]._node) {
      return sounds[0]._node;
    }
  } catch {
    // ignore
  }
  return null;
}

/** 供可视化/静音检测读取的频谱分析节点 */
export function getAnalyser(): AnalyserNode | null {
  return analyserNode;
}

// source → filters → analyser → destination
function routeThroughEQ() {
  if (!sourceNode || !audioContext || !analyserNode) return;
  try {
    sourceNode.disconnect();
    for (const f of filterNodes) f.disconnect();
    analyserNode.disconnect();

    let prev: AudioNode = sourceNode;
    for (const filter of filterNodes) {
      prev.connect(filter);
      prev = filter;
    }
    prev.connect(analyserNode);
    analyserNode.connect(audioContext.destination);
  } catch {
    // ignore
  }
}

// source → destination（EQ 旁路，音频继续出声）
function routeDirect() {
  if (!sourceNode || !audioContext) return;
  try {
    sourceNode.disconnect();
    for (const f of filterNodes) f.disconnect();
    analyserNode?.disconnect();
    sourceNode.connect(audioContext.destination);
  } catch {
    // ignore
  }
}

function teardownOldGraph() {
  try {
    sourceNode?.disconnect();
  } catch { /* ignore */ }
  for (const f of filterNodes) {
    try {
      f.disconnect();
    } catch { /* ignore */ }
  }
  try {
    analyserNode?.disconnect();
  } catch { /* ignore */ }
  sourceNode = null;
  filterNodes = [];
  connectedEl = null;
}

/**
 * 为当前歌曲的音频元素建立 Web Audio 图。
 * 每次切歌调用一次；enabled=false 时不捕获元素（音频完全走原生输出，零风险）。
 */
export function setupEQForHowl(howl: Howl, bands: EQBand[], enabled: boolean): boolean {
  if (!enabled) return false;

  const ctx = getAudioContext();
  const audioEl = getAudioElement(howl);
  if (!ctx || !audioEl) return false;

  // 同一元素重复调用（例如快速切歌后同 URL 复用）只需重连
  if (connectedEl === audioEl && sourceNode) {
    applyBands(bands);
    routeThroughEQ();
    return true;
  }

  // 上一首歌的元素已被回收，丢弃旧节点
  teardownOldGraph();

  try {
    sourceNode = ctx.createMediaElementSource(audioEl);
    connectedEl = audioEl;

    filterNodes = bands.map((band) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = band.frequency;
      filter.Q.value = 1.0;
      filter.gain.value = band.gain;
      return filter;
    });

    if (!analyserNode) {
      analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 64;
      analyserNode.smoothingTimeConstant = 0.8;
    }

    routeThroughEQ();
    return true;
  } catch {
    teardownOldGraph();
    return false;
  }
}

/** EQ 开关切换（元素已被捕获时旁路/恢复 EQ 链） */
export function setEQBypass(bypass: boolean) {
  if (bypass) {
    routeDirect();
  } else {
    routeThroughEQ();
  }
}

/** 应用新的频段增益（拖动滑块/切换预设时实时生效） */
export function applyBands(bands: EQBand[]) {
  for (let i = 0; i < bands.length && i < filterNodes.length; i++) {
    filterNodes[i].gain.value = bands[i].gain;
  }
}

/** 彻底断开并丢弃整条链（目前仅在异常恢复时使用） */
export function disconnectEQ() {
  teardownOldGraph();
}

export function destroyEQ() {
  teardownOldGraph();
  audioContext?.close();
  audioContext = null;
  analyserNode = null;
}

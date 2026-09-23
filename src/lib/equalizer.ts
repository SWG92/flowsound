"use client";

import type { Howl } from "howler";
import type { EQBand } from "./eq-store";

// Web Audio EQ 引擎。
//
// 三个必须遵守的约束（踩过的坑都记在这里）：
// 1. createMediaElementSource 对同一个音频元素只能调用一次 —— 必须按元素缓存整条音频图，
//    不能每次切歌都重建（Howler 的 html5 模式会复用音频元素）。
// 2. 元素一旦被 MediaElementSource 捕获，其输出就永远走 Web Audio 图 ——
//    所以"关闭 EQ"不能断开 source，只能把 source 直连 destination 旁路，否则会静音。
// 3. 跨域音频必须带 crossOrigin="anonymous" 加载，否则元素被污染、Web Audio 拿到的是静音
//    （Howler 不会设置 crossOrigin，由 audio-player 按需注入）。

interface EQGraph {
  element: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  filters: BiquadFilterNode[];
  analyser: AnalyserNode;
}

let audioContext: AudioContext | null = null;
// 按音频元素缓存图：同一元素复用，不会第二次调用 createMediaElementSource
const graphs = new WeakMap<HTMLAudioElement, EQGraph>();
// 当前正在使用（被路由）的图
let activeGraph: EQGraph | null = null;

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

/** 供静音看门狗读取的频谱分析节点 */
export function getAnalyser(): AnalyserNode | null {
  return activeGraph?.analyser ?? null;
}

// source → filters → analyser → destination
function routeThroughEQ(graph: EQGraph) {
  if (!audioContext) return;
  try {
    graph.source.disconnect();
    for (const f of graph.filters) f.disconnect();
    graph.analyser.disconnect();

    let prev: AudioNode = graph.source;
    for (const filter of graph.filters) {
      prev.connect(filter);
      prev = filter;
    }
    prev.connect(graph.analyser);
    graph.analyser.connect(audioContext.destination);
  } catch {
    // ignore
  }
}

// source → destination（EQ 旁路，但音频仍在 Web Audio 图里，不会断声）
function routeDirect(graph: EQGraph) {
  if (!audioContext) return;
  try {
    graph.source.disconnect();
    for (const f of graph.filters) f.disconnect();
    graph.analyser.disconnect();
    graph.source.connect(audioContext.destination);
  } catch {
    // ignore
  }
}

function createGraph(element: HTMLAudioElement, bands: EQBand[]): EQGraph | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  try {
    const source = ctx.createMediaElementSource(element);
    const filters = bands.map((band) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = band.frequency;
      filter.Q.value = 1.0;
      filter.gain.value = band.gain;
      return filter;
    });
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

    const graph: EQGraph = { element, source, filters, analyser };
    graphs.set(element, graph);
    return graph;
  } catch {
    // 元素已被其他节点捕获等情况：放弃 EQ，保持原生播放
    return null;
  }
}

/**
 * 为当前歌曲建立/复用 Web Audio 图。
 * 元素已建过图则直接复用（切歌/切回同一元素都安全）。
 */
export function setupEQForHowl(howl: Howl, bands: EQBand[], enabled: boolean): boolean {
  if (!enabled) return false;

  const element = getAudioElement(howl);
  if (!element) return false;

  let graph = graphs.get(element) ?? null;
  if (!graph) {
    graph = createGraph(element, bands);
  } else {
    applyBands(bands, graph);
  }
  if (!graph) return false;

  activeGraph = graph;
  routeThroughEQ(graph);
  return true;
}

/** EQ 开关切换（元素已被捕获时旁路/恢复 EQ 链） */
export function setEQBypass(bypass: boolean) {
  if (bypass) {
    if (activeGraph) routeDirect(activeGraph);
  } else if (activeGraph) {
    routeThroughEQ(activeGraph);
  }
}

/** 应用新的频段增益（拖动滑块/切换预设时实时生效） */
export function applyBands(bands: EQBand[], graph?: EQGraph | null) {
  const target = graph ?? activeGraph;
  if (!target) return;
  for (let i = 0; i < bands.length && i < target.filters.length; i++) {
    target.filters[i].gain.value = bands[i].gain;
  }
}

/** 当前激活的音频元素是否已建立 Web Audio 图 */
export function hasActiveGraph(): boolean {
  return activeGraph !== null;
}

export function destroyEQ() {
  activeGraph = null;
  audioContext?.close();
  audioContext = null;
}

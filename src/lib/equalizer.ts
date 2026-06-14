"use client";

import { Howl } from "howler";
import { useEQStore, type EQBand } from "./eq-store";

let audioContext: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let filterNodes: BiquadFilterNode[] = [];
let analyserPassthrough: AnalyserNode | null = null;
let isConnected = false;

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

/**
 * 连接 EQ 处理链到 Howl 的音频元素。
 * 音频图：source → [EQ filters] → analyser → destination
 */
export function connectEQ(howl: Howl): boolean {
  if (isConnected) return true;

  const ctx = getAudioContext();
  if (!ctx) return false;

  const audioEl = getAudioElement(howl);
  if (!audioEl) return false;

  try {
    sourceNode = ctx.createMediaElementSource(audioEl);

    const bands = useEQStore.getState().bands;

    // 创建峰值滤波器链
    filterNodes = bands.map((band) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = band.frequency;
      filter.Q.value = 1.0;
      filter.gain.value = band.gain;
      return filter;
    });

    // 分析器节点（用于可视化）
    analyserPassthrough = ctx.createAnalyser();
    analyserPassthrough.fftSize = 64;
    analyserPassthrough.smoothingTimeConstant = 0.8;

    // 连接链：source → filter0 → filter1 → ... → analyser → destination
    let prev: AudioNode = sourceNode;
    for (const filter of filterNodes) {
      prev.connect(filter);
      prev = filter;
    }
    prev.connect(analyserPassthrough);
    analyserPassthrough.connect(ctx.destination);

    isConnected = true;
    return true;
  } catch {
    disconnectEQ();
    return false;
  }
}

export function updateEQBand(index: number, gain: number) {
  if (index >= 0 && index < filterNodes.length) {
    filterNodes[index].gain.value = gain;
  }
}

export function updateAllBands(bands: EQBand[]) {
  for (let i = 0; i < bands.length && i < filterNodes.length; i++) {
    filterNodes[i].gain.value = bands[i].gain;
  }
}

export function disconnectEQ() {
  try {
    sourceNode?.disconnect();
    for (const filter of filterNodes) {
      filter.disconnect();
    }
    analyserPassthrough?.disconnect();
  } catch {
    // ignore
  }
  sourceNode = null;
  filterNodes = [];
  analyserPassthrough = null;
  isConnected = false;
}

export function destroyEQ() {
  disconnectEQ();
  audioContext?.close();
  audioContext = null;
}

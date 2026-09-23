"use client";

import { Howler } from "howler";

// 让 Howler 的 html5 音频元素带 CORS 加载 —— EQ 需要它。
//
// 背景：Web Audio 的 createMediaElementSource 要求媒体是"跨域干净"的。
// 不带 crossOrigin 加载的元素会被污染，接入 Web Audio 后输出恒为静音
// （实测：带 crossOrigin 频谱总量 3270，不带为 0）。Howler 自身不设置 crossOrigin。
//
// 两个必须处理的点：
// 1. Howler 用全局音频元素池复用元素，而 createMediaElementSource 对同一元素只能调用一次，
//    且元素一旦接入 Web Audio 就永远走该图 —— 若复用给一个不支持 CORS 的音源就会静音。
//    因此这里给"EQ 专用"的元素打标记，释放时不回池（用后即弃）。
// 2. 不支持 CORS 的音源带上 crossOrigin 会直接加载失败，所以只在探测确认支持后才注入。

const MARK = "__flowsoundEQCors";

interface MarkedElement extends HTMLAudioElement {
  [MARK]?: boolean;
}

// 由 audio-player 在创建 Howl 前设置：本次加载是否需要 CORS 化的音频元素
let pendingCors = false;

export function setPendingCors(value: boolean) {
  pendingCors = value;
}

type ObtainFn = () => HTMLAudioElement;
type ReleaseFn = (audio: HTMLAudioElement) => void;

let installed = false;

/** 安装到 Howler 的音频元素池钩子（幂等，只需调用一次） */
export function installHowlerCorsHook() {
  if (installed) return;
  const howler = Howler as unknown as {
    _obtainHtml5Audio?: ObtainFn;
    _releaseHtml5Audio?: ReleaseFn;
  };
  if (typeof howler._obtainHtml5Audio !== "function") return;

  const originalObtain = howler._obtainHtml5Audio.bind(Howler);
  const originalRelease = howler._releaseHtml5Audio?.bind(Howler);

  howler._obtainHtml5Audio = function (): HTMLAudioElement {
    const el = originalObtain() as MarkedElement;
    if (pendingCors && el) {
      el.crossOrigin = "anonymous";
      el[MARK] = true;
    }
    return el;
  };

  if (originalRelease) {
    howler._releaseHtml5Audio = function (audio: HTMLAudioElement) {
      // 已接入 Web Audio 的元素绝不回池：复用给不支持 CORS 的音源会变静音
      if ((audio as MarkedElement)[MARK]) return;
      originalRelease(audio);
    };
  }

  installed = true;
}

/**
 * 探测音频地址是否允许跨域加载。
 * 只取 1 字节，代价很小；用于决定能否为该音源启用 EQ（避免 crossOrigin 导致加载失败）。
 */
const corsCache = new Map<string, boolean>();

export async function probeCors(url: string): Promise<boolean> {
  const cached = corsCache.get(url);
  if (cached !== undefined) return cached;

  let ok = false;
  try {
    const res = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers: { Range: "bytes=0-1" },
      signal: AbortSignal.timeout(5000),
    });
    ok = res.ok || res.status === 206;
  } catch {
    ok = false;
  }

  // 简单控制缓存体积
  if (corsCache.size > 50) corsCache.clear();
  corsCache.set(url, ok);
  return ok;
}

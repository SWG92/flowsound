"use client";

import { Howl } from "howler";
import { usePlayerStore } from "./store";
import { useToastStore } from "./toast-store";
import { useEQStore } from "./eq-store";
import { setupEQForHowl, setEQBypass, applyBands, getAnalyser } from "./equalizer";
import { logError } from "./logger";

type SongStartCallback = (howl: Howl) => void;

// 全局单例音频播放器
class AudioPlayer {
  private static instance: AudioPlayer;
  private sound: Howl | null = null;
  private animFrame: number = 0;
  private isUpdating = false;
  private endTimeout: ReturnType<typeof setTimeout> | null = null;

  // 歌曲切换通知（供可视化器等模块重新绑定音频元素）
  private songStartCallbacks: Set<SongStartCallback> = new Set();
  // 拖拽进度条时暂停 rAF 时间更新，防止滑块抽搐
  private isSeeking = false;

  // EQ 静音看门狗：跨域无 CORS 的音源经过 Web Audio 会输出静音，需检测并回退
  private eqWatchdog: ReturnType<typeof setInterval> | null = null;
  private eqSilentCount = 0;

  // 当前播放参数（供 EQ 回退时原地重建播放）
  private lastUrl = "";
  private lastVolume = 0.8;
  private lastSpeed = 1;
  private pendingSeek = 0;

  private constructor() {}

  static getInstance(): AudioPlayer {
    if (!AudioPlayer.instance) {
      AudioPlayer.instance = new AudioPlayer();
    }
    return AudioPlayer.instance;
  }

  // 获取当前 Howl 实例
  getHowl(): Howl | null {
    return this.sound;
  }

  // 订阅新歌开始事件（切歌时触发，用于重新绑定 Web Audio 分析节点）
  onSongStart(cb: SongStartCallback): () => void {
    this.songStartCallbacks.add(cb);
    return () => {
      this.songStartCallbacks.delete(cb);
    };
  }

  private notifySongStart() {
    if (!this.sound) return;
    for (const cb of this.songStartCallbacks) {
      cb(this.sound);
    }
  }

  // 播放新歌曲
  play(url: string, volume: number, speed: number) {
    // 取消待执行的 onend 回调
    if (this.endTimeout) {
      clearTimeout(this.endTimeout);
      this.endTimeout = null;
    }

    this.lastUrl = url;
    this.lastVolume = volume;
    this.lastSpeed = speed;

    // 停止当前播放
    this.stopInternal();

    this.sound = new Howl({
      src: [url],
      html5: true, // HTML5 Audio 模式：兼容性好，支持 CDN 跨域音频流
      volume,
      rate: speed,
      onplay: () => {
        const duration = this.sound?.duration() || 0;
        usePlayerStore.getState().setDuration(duration);
        usePlayerStore.getState().setPlaying(true);
        this.startTimeUpdate();
        // 通知可视化器等模块：新的音频元素已就绪
        this.notifySongStart();
        // EQ 开启时为新音频元素建立 Web Audio 图
        this.setupEQ();
        // 恢复重建前的播放进度（EQ 静音回退场景）
        if (this.pendingSeek > 0) {
          const t = this.pendingSeek;
          this.pendingSeek = 0;
          try {
            this.sound?.seek(t);
          } catch { /* ignore */ }
        }
      },
      // HTML5 流媒体在 onplay 触发时 duration 可能还是 0，元数据加载完成后补一次
      onload: () => {
        const d = this.sound?.duration() || 0;
        if (d > 0) usePlayerStore.getState().setDuration(d);
      },
      onpause: () => {
        this.stopTimeUpdate();
      },
      onend: () => {
        this.stopTimeUpdate();
        // 保存当前 sound 引用，避免被新 play() 清除
        const endedSound = this.sound;
        this.endTimeout = setTimeout(() => {
          // 只在 sound 没有被替换时才执行
          if (this.sound !== endedSound) return;
          const { playMode } = usePlayerStore.getState();
          if (playMode === "single") {
            this.sound?.play();
          } else {
            usePlayerStore.getState().nextSong();
          }
        }, 100);
      },
      onloaderror: (_id, err: unknown) => {
        logError("Audio load error:", err);
        usePlayerStore.getState().setPlaying(false);
        usePlayerStore.getState().setLoading(false);
        try {
          useToastStore
            .getState()
            .showToast("歌曲加载失败，请切换音质或稍后重试", "error");
        } catch {
          // toast store 可能未初始化
        }
      },
    });

    this.sound.play();
  }

  // ===== EQ 接入 =====

  private setupEQ() {
    if (!this.sound) return;
    const { enabled, bands } = useEQStore.getState();
    if (!enabled) return;
    const ok = setupEQForHowl(this.sound, bands, true);
    if (ok) {
      this.startEQWatchdog();
    }
  }

  // 面板里手动开启 EQ 时对当前歌曲立即生效
  enableEQNow() {
    this.setupEQ();
  }

  // 静音看门狗：EQ 接入后若持续 2 秒无频谱输出（但确实在播放），
  // 判定该音源不支持 Web Audio（跨域受限），自动关闭 EQ 并原地重建直连播放。
  private startEQWatchdog() {
    this.stopEQWatchdog();
    this.eqSilentCount = 0;
    this.eqWatchdog = setInterval(() => {
      const howl = this.sound;
      const analyser = getAnalyser();
      if (!howl || !analyser) return;
      // 静音/极低音量/音量渐弱时不判定，避免误伤
      if (usePlayerStore.getState().volume < 0.01) {
        this.eqSilentCount = 0;
        return;
      }
      if (!howl.playing()) {
        this.eqSilentCount = 0;
        return;
      }
      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);
      let hasSignal = false;
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] > 0) {
          hasSignal = true;
          break;
        }
      }
      if (hasSignal) {
        this.eqSilentCount = 0;
        return;
      }
      this.eqSilentCount++;
      if (this.eqSilentCount >= 4) {
        this.stopEQWatchdog();
        useEQStore.setState({ enabled: false });
        try {
          localStorage.setItem("flowsound_eq_enabled", "0");
        } catch { /* ignore */ }
        try {
          useToastStore
            .getState()
            .showToast("当前音源不支持均衡器，已自动关闭", "warning");
        } catch { /* ignore */ }
        this.restartCurrent();
      }
    }, 500);
  }

  stopEQWatchdog() {
    if (this.eqWatchdog) {
      clearInterval(this.eqWatchdog);
      this.eqWatchdog = null;
    }
    this.eqSilentCount = 0;
  }

  // 原地重建当前播放（用于 EQ 静音回退：新元素不再走 Web Audio，声音恢复）
  restartCurrent() {
    const url = this.lastUrl;
    if (!url || !this.sound) return;
    const pos = this.sound.seek();
    this.pendingSeek = typeof pos === "number" && !isNaN(pos) && pos > 1 ? pos : 0;
    this.play(url, this.lastVolume, this.lastSpeed);
  }

  // ===== 基础控制 =====

  // 暂停
  pause() {
    if (this.sound && this.sound.playing()) {
      this.sound.pause();
    }
    this.stopTimeUpdate();
  }

  // 继续播放
  resume() {
    if (this.sound && !this.sound.playing()) {
      this.sound.play();
    }
  }

  // 设置拖拽状态（进度条拖动时暂停 rAF 时间更新，防止抽搐）
  setSeeking(seeking: boolean) {
    this.isSeeking = seeking;
  }

  // 跳转
  seek(time: number) {
    if (this.sound) {
      this.sound.seek(time);
      usePlayerStore.getState().setCurrentTime(time);
    }
  }

  // 设置音量
  setVolume(volume: number) {
    this.sound?.volume(volume);
  }

  // 设置倍速
  setSpeed(speed: number) {
    this.lastSpeed = speed;
    this.sound?.rate(speed);
  }

  // 停止内部
  private stopInternal() {
    this.stopTimeUpdate();
    if (this.sound) {
      this.sound.unload();
      this.sound = null;
    }
  }

  // 开始时间更新循环
  private startTimeUpdate() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    let lastStoreUpdate = 0;
    const STORE_UPDATE_INTERVAL = 250; // 每 250ms 更新一次 UI 状态，减少重渲染

    const update = () => {
      if (!this.sound || !this.isUpdating) {
        this.isUpdating = false;
        return;
      }

      try {
        const time = this.sound.seek();
        if (typeof time === "number" && !isNaN(time)) {
          const now = performance.now();

          // 用户拖动进度条时暂停时间更新，防止滑块抽搐
          // 同时限流 UI 更新到 250ms 间隔，避免每秒 60 次 Zustand 重渲染导致页面卡顿
          if (!this.isSeeking && now - lastStoreUpdate >= STORE_UPDATE_INTERVAL) {
            lastStoreUpdate = now;
            usePlayerStore.getState().setCurrentTime(time);
          }

          // 歌词索引检测：每帧都执行，确保歌词同步精度
          const { lyrics, currentLyricIndex } = usePlayerStore.getState();
          if (lyrics.length > 0) {
            let newIndex = -1;
            for (let i = lyrics.length - 1; i >= 0; i--) {
              if (time >= lyrics[i].time) {
                newIndex = i;
                break;
              }
            }
            if (newIndex !== currentLyricIndex) {
              usePlayerStore.getState().setCurrentLyricIndex(newIndex);
            }
          }
        }
      } catch {
        // ignore seek errors
      }

      this.animFrame = requestAnimationFrame(update);
    };

    this.animFrame = requestAnimationFrame(update);
  }

  // 停止时间更新
  private stopTimeUpdate() {
    this.isUpdating = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = 0;
    }
  }
}

export const audioPlayer = AudioPlayer.getInstance();

// EQ store 订阅：开关切换时对当前歌曲立即生效，频段变化实时应用
useEQStore.subscribe((state, prev) => {
  if (state.enabled !== prev.enabled) {
    if (state.enabled) {
      audioPlayer.enableEQNow();
    } else {
      setEQBypass(true);
      audioPlayer.stopEQWatchdog();
    }
  } else if (state.bands !== prev.bands) {
    applyBands(state.bands);
  }
});

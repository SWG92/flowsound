"use client";

import { useEffect } from "react";
import { useKeyboard } from "@/hooks/use-keyboard";
import { getDesktop } from "@/lib/desktop";
import { DesktopMediaBridge } from "@/components/electron/desktop-media-bridge";
import { PERFORMANCE_KEY } from "@/lib/constants";

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  console.warn("[mount] ClientWrapper");
  useKeyboard();

  // Service Worker：仅浏览器端注册（PWA 离线缓存）。
  // 桌面壳内必须禁用——SW 的请求拦截/生命周期切换（skipWaiting 激活）会掐断
  // 正在进行的路由 fetch，触发 Next 的 MPA 降级（整页硬刷新），播放随之停摆；
  // 且桌面端内容由内嵌 localhost 服务器提供，根本不需要离线缓存。
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (getDesktop()) {
      // 清掉历史遗留的 SW 注册，防止旧 SW 继续拦截请求
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // 应用性能模式（设置页开关）：关闭背景模糊与光斑动画，低配设备更流畅
  useEffect(() => {
    if (localStorage.getItem(PERFORMANCE_KEY) === "1") {
      document.documentElement.classList.add("performance");
    }
  }, []);

  // ChunkLoadError 自动恢复：热更新重建或重启 dev 服务器后，
  // 未刷新的旧标签页仍会请求已失效的 chunk 而白屏。
  // 捕获后自动整页刷新一次（sessionStorage 标记防止循环），15 秒后清除标记。
  useEffect(() => {
    const CHUNK_FAIL = /Loading (CSS )?chunk .+ failed/;
    const canReload = () => {
      try {
        return !sessionStorage.getItem("flowsound_chunk_reload");
      } catch {
        return false;
      }
    };
    const markReload = () => {
      try {
        sessionStorage.setItem("flowsound_chunk_reload", "1");
      } catch {
        // ignore
      }
    };
    const onError = (e: ErrorEvent) => {
      if (CHUNK_FAIL.test(e.message || "") && canReload()) {
        markReload();
        window.location.reload();
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
      if (CHUNK_FAIL.test(msg) && canReload()) {
        markReload();
        window.location.reload();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    const t = setTimeout(() => {
      try {
        sessionStorage.removeItem("flowsound_chunk_reload");
      } catch {
        // ignore
      }
    }, 15000);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      clearTimeout(t);
    };
  }, []);

  return (
    <>
      <DesktopMediaBridge />
      {children}
    </>
  );
}

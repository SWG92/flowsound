"use client";

import { useEffect } from "react";
import { useKeyboard } from "@/hooks/use-keyboard";

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  useKeyboard();

  // 注册 PWA Service Worker
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
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

  return <>{children}</>;
}

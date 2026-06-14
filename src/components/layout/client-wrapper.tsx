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

  return <>{children}</>;
}


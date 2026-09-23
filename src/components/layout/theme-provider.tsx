"use client";

import { useEffect } from "react";
import { usePlayerStore, writeThemeCookie } from "@/lib/store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePlayerStore((s) => s.theme);

  // 主题类由服务端按 Cookie 渲染；这里负责客户端切换时同步，
  // 并补写 Cookie（老用户只有 localStorage、还没有 Cookie 的情况）
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    writeThemeCookie(theme);
  }, [theme]);

  // 首次访问（没有任何记录）时跟随系统偏好
  useEffect(() => {
    const stored = localStorage.getItem("flowsound_theme");
    if (!stored) {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      usePlayerStore.getState().setTheme(prefersDark ? "dark" : "light");
    }
  }, []);

  return <>{children}</>;
}

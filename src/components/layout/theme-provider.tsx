"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/lib/store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePlayerStore((s) => s.theme);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [theme]);

  // 监听系统主题变化
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      // 只在用户未手动设置主题时跟随系统
      const stored = localStorage.getItem("flowsound_theme");
      if (!stored) {
        const html = document.documentElement;
        if (e.matches) {
          html.classList.add("dark");
        } else {
          html.classList.remove("dark");
        }
      }
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // 首次加载时检测系统偏好
  useEffect(() => {
    const stored = localStorage.getItem("flowsound_theme");
    if (!stored) {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      if (prefersDark) {
        usePlayerStore.getState().setTheme("dark");
      }
    }
  }, []);

  return <>{children}</>;
}

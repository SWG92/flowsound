"use client";

import { useEffect } from "react";
import { usePlayerStore, writeThemeCookie } from "@/lib/store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePlayerStore((s) => s.theme);

  // 客户端切换主题时同步类名（首屏类名由服务端按 Cookie 渲染）
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
      html.classList.remove("light");
    } else {
      html.classList.add("light");
      html.classList.remove("dark");
    }
  }, [theme]);

  // 挂载后校正一次主题来源：
  // - 已有 Cookie：服务端已渲染正确主题，无需处理
  // - 无 Cookie：老用户读 localStorage，首次访问跟随系统偏好；两种都补写 Cookie，
  //   使后续访问由服务端直出正确主题（无需脚本、无闪烁）
  useEffect(() => {
    const hasCookie = document.cookie.includes("flowsound_theme=");
    if (hasCookie) return;

    const stored = localStorage.getItem("flowsound_theme");
    let value: "light" | "dark" | null = null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        value = parsed === "dark" ? "dark" : parsed === "light" ? "light" : null;
      } catch {
        value = stored === "dark" ? "dark" : stored === "light" ? "light" : null;
      }
    }
    if (!value) {
      value = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    if (usePlayerStore.getState().theme !== value) {
      usePlayerStore.getState().setTheme(value);
    } else {
      writeThemeCookie(value);
    }
  }, []);

  return <>{children}</>;
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Heart,
  Clock,
  ListMusic,
  Music2,
  Sparkles,
  Sun,
  Moon,
  Settings,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/lib/store";

const NAV_ITEMS = [
  { href: "/", label: "发现音乐", icon: Home },
  { href: "/daily", label: "每日推荐", icon: Sparkles },
];

const LIBRARY_ITEMS = [
  { href: "/favorites", label: "我喜欢的", icon: Heart },
  { href: "/history", label: "最近播放", icon: Clock },
  { href: "/playlist", label: "歌单", icon: ListMusic },
  { href: "/blacklist", label: "黑名单", icon: Ban },
];

export function Sidebar() {
  const pathname = usePathname();
  const theme = usePlayerStore((s) => s.theme);
  const setTheme = usePlayerStore((s) => s.setTheme);
  // 防止 SSR 水合不匹配：服务端始终渲染 light 模式占位
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 glass h-[calc(100vh-5rem)] rounded-xl m-2 mr-0 p-4 overflow-hidden sticky top-2 self-start">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Music2 className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold gradient-text">FlowSound</span>
      </Link>

      {/* 主导航 */}
      <nav className="space-y-1 mb-6">
        <p className="text-xs text-muted-foreground px-2 mb-2 uppercase tracking-wider">
          推荐
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 我的音乐 */}
      <nav className="space-y-1 flex-1">
        <p className="text-xs text-muted-foreground px-2 mb-2 uppercase tracking-wider">
          我的音乐
        </p>
        {LIBRARY_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 底部：设置 + 主题切换 */}
      <div className="border-t border-border/50 pt-3 space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
            pathname === "/settings"
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          <Settings className="h-4 w-4" />
          设置
        </Link>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors w-full text-left cursor-pointer"
        >
          {mounted ? (
            theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )
          ) : (
            <div className="h-4 w-4" />
          )}
          {mounted ? (theme === "dark" ? "浅色模式" : "深色模式") : "深色模式"}
        </button>
      </div>
    </aside>
  );
}

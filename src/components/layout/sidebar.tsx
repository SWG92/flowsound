"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Heart, Clock, ListMusic, Music2, Sparkles,
  Sun, Moon, Settings, Ban, Menu, X,
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
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // 导航后自动关闭移动侧栏
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const navContent = (
    <>
      {/* 移动端 Logo + 关闭按钮 */}
      <div className="flex items-center justify-between mb-8 px-2 md:hidden">
        <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Music2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold gradient-text">FlowSound</span>
        </Link>
        <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 桌面端 Logo */}
      <Link href="/" className="hidden md:flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Music2 className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold gradient-text">FlowSound</span>
      </Link>

      <nav className="space-y-1 mb-6">
        <p className="text-xs text-muted-foreground px-2 mb-2 uppercase tracking-wider">推荐</p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors", active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-white/5")}>
              <Icon className="h-4 w-4" />{item.label}
            </Link>
          );
        })}
      </nav>

      <nav className="space-y-1 flex-1">
        <p className="text-xs text-muted-foreground px-2 mb-2 uppercase tracking-wider">我的音乐</p>
        {LIBRARY_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors", active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-white/5")}>
              <Icon className="h-4 w-4" />{item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/50 pt-3 space-y-1">
        <Link href="/settings" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors", pathname === "/settings" ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-white/5")}>
          <Settings className="h-4 w-4" />设置
        </Link>
        <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors w-full text-left cursor-pointer">
          {mounted ? (theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <div className="h-4 w-4" />}
          {mounted ? (theme === "dark" ? "浅色模式" : "深色模式") : "深色模式"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* 桌面端：固定侧栏 */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 glass h-[calc(100vh-5rem)] rounded-xl m-2 mr-0 p-4 overflow-hidden sticky top-2 self-start">
        {navContent}
      </aside>

      {/* 移动端：汉堡按钮 */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 p-2 rounded-lg glass cursor-pointer"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* 移动端：遮罩 */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* 移动端：侧滑抽屉 */}
      <aside className={cn(
        "md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 glass p-4 overflow-y-auto transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ borderRadius: "0 12px 12px 0" }}>
        {navContent}
      </aside>
    </>
  );
}
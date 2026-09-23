import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientWrapper } from "@/components/layout/client-wrapper";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ToastContainer } from "@/components/ui/toast";
import { ConditionalLayout } from "@/components/layout/conditional-layout";
import { THEME_COOKIE } from "@/lib/constants";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "FlowSound - 音乐播放器",
  description: "全平台聚合音乐 — 网易云 + QQ音乐 + 酷狗",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FlowSound",
    startupImage: ["/icon-512.svg"],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 主题在服务端按 Cookie 渲染：首屏 HTML 直接带正确的 class，
  // 不需要任何内联脚本，也就不存在 React 19 "组件内渲染 script" 的警告与首屏闪烁。
  const cookieStore = await cookies();
  const theme = cookieStore.get(THEME_COOKIE)?.value;
  // 显式渲染 light/dark 两个类之一：客户端 store 以这个类名作为首屏主题值，
  // 从而保证水合前后一致（无类名时无法区分"服务端判定为浅色"和"没有服务端信息"）
  const themeClass = theme === "dark" ? "dark" : "light";

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${themeClass}`.trim()}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className="h-screen overflow-hidden bg-gradient-main text-foreground flex">
        <ThemeProvider>
          <ClientWrapper>
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
            <ToastContainer />
          </ClientWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}

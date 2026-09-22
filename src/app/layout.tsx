import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ClientWrapper } from "@/components/layout/client-wrapper";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ToastContainer } from "@/components/ui/toast";
import { ConditionalLayout } from "@/components/layout/conditional-layout";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className="h-screen overflow-hidden bg-gradient-main text-foreground flex">
        {/* 在水合前根据 localStorage/系统偏好设置主题 class，避免深色模式首屏闪白。
            beforeInteractive 会被注入到初始 HTML 的 head 中，先于任何 Next.js 代码执行。
            用外链而非内联：内联形式的 beforeInteractive 会被放进 __next_s 队列延后执行，
            起不到防闪烁作用；外链会被预加载并优先执行。 */}
        <Script src="/theme-init.js" strategy="beforeInteractive" />
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

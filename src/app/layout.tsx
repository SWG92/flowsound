import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

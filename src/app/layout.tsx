import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "FlowSound - 音乐播放器",
  description: "发现音乐，享受自由",
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

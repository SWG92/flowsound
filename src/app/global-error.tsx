"use client";

import { useEffect } from "react";

/** 根布局级错误边界（仅根布局自身崩溃时触发，此时全局样式可能不可用，
 * 故用内联样式保证提示可见）。 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[FlowSound] 应用级错误:", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f0f18",
          color: "#e8e8f0",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎵</div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            FlowSound 加载失败
          </h1>
          <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 20px" }}>
            可能是网络波动或版本更新，刷新一下就好
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => unstable_retry()}
              style={{
                padding: "9px 18px",
                borderRadius: 10,
                border: "none",
                background: "#8b5cf6",
                color: "#fff",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              重试
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "9px 18px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                color: "#e8e8f0",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** 页面级错误边界：任一页面组件崩溃时展示可恢复的提示，而不是整站白屏。
 * 恢复用 Next 16 推荐的 unstable_retry（重新请求数据并重渲染，适合网络抖动场景）。 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // 记录到控制台便于排查（生产环境不把堆栈暴露在界面上）
    console.error("[FlowSound] 页面渲染错误:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">这个页面出了点问题</h2>
        <p className="text-sm text-muted-foreground mt-1">
          其他页面不受影响，可以重试或回到首页继续听歌
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => unstable_retry()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors"
        >
          重试
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg border border-border text-sm cursor-pointer hover:bg-muted/50 transition-colors"
        >
          回到首页
        </Link>
      </div>
    </div>
  );
}

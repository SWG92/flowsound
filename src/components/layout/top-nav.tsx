"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavHistory } from "@/lib/nav-history";

export function TopNav() {
  const router = useRouter();
  const canGoBack = useNavHistory((s) => s.canGoBack());
  const canGoForward = useNavHistory((s) => s.canGoForward());
  const goBack = useNavHistory((s) => s.goBack);
  const goForward = useNavHistory((s) => s.goForward);

  const handleBack = () => {
    const path = goBack();
    if (path) router.push(path);
  };

  const handleForward = () => {
    const path = goForward();
    if (path) router.push(path);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-2">
      <button
        onClick={handleBack}
        disabled={!canGoBack}
        className="p-1.5 rounded-full transition-colors cursor-pointer disabled:cursor-default"
        style={{
          background: canGoBack ? "rgba(255,255,255,0.08)" : "transparent",
          color: canGoBack ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
        }}
        onMouseEnter={(e) => {
          if (canGoBack) e.currentTarget.style.background = "rgba(255,255,255,0.15)";
        }}
        onMouseLeave={(e) => {
          if (canGoBack) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        }}
        title="后退"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={handleForward}
        disabled={!canGoForward}
        className="p-1.5 rounded-full transition-colors cursor-pointer disabled:cursor-default"
        style={{
          background: canGoForward ? "rgba(255,255,255,0.08)" : "transparent",
          color: canGoForward ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
        }}
        onMouseEnter={(e) => {
          if (canGoForward) e.currentTarget.style.background = "rgba(255,255,255,0.15)";
        }}
        onMouseLeave={(e) => {
          if (canGoForward) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        }}
        title="前进"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

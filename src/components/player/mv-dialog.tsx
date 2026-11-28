"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchMvDetail, type MvDetail } from "@/lib/api";

/**
 * MV 播放弹窗：全屏黑底 + <video> 原生控制。
 * 清晰度默认选最高可用档（1080P > 720P > 480P），可随时切换。
 * 背景层点击关闭，视频区点击不关闭。
 */

const QUALITY_ORDER = ["1080", "720", "480", "240"] as const;

export function MvDialog({
  mvId,
  name,
  artists,
  onClose,
}: {
  mvId: number;
  name: string;
  artists?: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<MvDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [quality, setQuality] = useState<string>("480P");

  useEffect(() => {
    let cancelled = false;
    fetchMvDetail(mvId).then((d) => {
      if (cancelled) return;
      if (!d) setFailed(true);
      else {
        setDetail(d);
        const best = QUALITY_ORDER.find((q) => d.brs?.[q]);
        if (best) setQuality(best);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mvId]);

  const qualities = useMemo(
    () => QUALITY_ORDER.filter((q) => detail?.brs?.[q]),
    [detail]
  );
  const src = detail?.brs?.[quality] || "";

  return (
    <div className="fixed inset-0 z-[130] bg-black/95 flex flex-col animate-in fade-in-0 duration-200">
      {/* 顶栏：标题 + 清晰度 + 关闭 */}
      <div
        className="relative z-10 flex items-center justify-between px-6 py-4"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingTop: "calc(1rem + var(--safe-top))" }}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">MV</p>
          <p className="text-sm text-white/90 truncate">
            {name}
            {artists ? <span className="text-white/50"> · {artists}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {qualities.map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors border",
                quality === q
                  ? "bg-white/15 text-white border-white/40"
                  : "text-white/60 border-white/20 hover:text-white hover:border-white/40"
              )}
            >
              {q}
            </button>
          ))}
          <button
            onClick={onClose}
            className="ml-2 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="关闭"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* 视频区 */}
      <div
        className="flex-1 flex items-center justify-center px-6 pb-6 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {failed ? (
          <p className="text-white/50 text-sm">MV 加载失败或已下架</p>
        ) : !detail ? (
          <Loader2 className="h-8 w-8 text-white/50 animate-spin" />
        ) : (
          <video
            key={src}
            src={src}
            controls
            autoPlay
            className="max-w-full max-h-full rounded-2xl shadow-2xl bg-black"
          />
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Loader2, X, AlertCircle } from "lucide-react";
import { getMvInfo, type MvInfo } from "@/lib/api";
import { usePlayerStore } from "@/lib/store";

/**
 * MV 视频浮层：点开即暂停音乐（避免双声），关闭后用户自行恢复播放。
 * 视频地址优先 480P，回退 240P（匿名可用档）。
 */
export function MvDialog({
  mvId,
  songName,
  open,
  onClose,
}: {
  mvId: number;
  songName?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<MvInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时暂停音乐（MV 自带音频，避免双声）
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => usePlayerStore.getState().setPlaying(false), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !mvId) return;
    let cancelled = false;
    // 项目 lint 规则：effect 内同步 setState 会级联渲染，统一异步置位
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      setInfo(null);
    }, 0);
    getMvInfo(mvId)
      .then((r) => {
        if (!cancelled) setInfo(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, mvId]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 + 关闭 */}
        <div className="flex items-center justify-between mb-3 pr-1">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{info?.name || songName || "MV"}</p>
            {info?.artistName && (
              <p className="text-xs text-white/50 truncate">{info.artistName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors shrink-0"
            title="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          ) : error ? (
            <div className="flex flex-col items-center gap-2 text-white/60 text-sm">
              <AlertCircle className="h-6 w-6" />
              <span>{error}，该 MV 暂不可播放</span>
            </div>
          ) : info ? (
            <video
              src={info.url480 || info.url240}
              poster={info.cover}
              controls
              autoPlay
              className="w-full h-full"
            />
          ) : null}
        </div>

        {loading && <div className="text-center text-xs text-white/40 mt-2">正在获取 MV 资源…</div>}
      </div>
    </div>
  );
}

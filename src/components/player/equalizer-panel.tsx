"use client";

import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useEQStore, EQ_PRESETS, type EQPresetName } from "@/lib/eq-store";
import { cn } from "@/lib/utils";

const PRESET_LABELS: Record<EQPresetName, string> = {
  normal: "普通",
  pop: "流行",
  rock: "摇滚",
  classical: "古典",
  jazz: "爵士",
  dance: "舞曲",
  vocal: "人声",
  custom: "自定义",
};

interface EQPanelProps {
  open: boolean;
  onClose: () => void;
}

export function EQPanel({ open, onClose }: EQPanelProps) {
  const enabled = useEQStore((s) => s.enabled);
  const bands = useEQStore((s) => s.bands);
  const preset = useEQStore((s) => s.preset);
  const toggleEQ = useEQStore((s) => s.toggleEQ);
  const setBand = useEQStore((s) => s.setBand);
  const setPreset = useEQStore((s) => s.setPreset);
  const resetBands = useEQStore((s) => s.resetBands);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 面板 */}
      <div className="relative glass rounded-2xl p-6 w-[480px] max-w-[95vw] max-h-[85vh] overflow-y-auto shadow-2xl z-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            均衡器
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant={enabled ? "default" : "outline"}
              size="sm"
              onClick={toggleEQ}
              className="cursor-pointer"
            >
              {enabled ? "已开启" : "已关闭"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="cursor-pointer h-8 w-8"
            >
              ✕
            </Button>
          </div>
        </div>

        {/* 预设选择 */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {(Object.keys(EQ_PRESETS) as EQPresetName[])
            .filter((p) => p !== "custom")
            .map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                  preset === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
        </div>

        {/* 频段滑块 */}
        <div className="flex items-end justify-between gap-2 h-48 mb-4">
          {bands.map((band, i) => (
            <div key={band.frequency} className="flex flex-col items-center gap-2 flex-1">
              <span className="text-[10px] text-muted-foreground font-mono">
                {band.gain > 0 ? "+" : ""}
                {band.gain.toFixed(1)}
              </span>
              <div className="flex-1 w-full flex justify-center">
                <Slider
                  orientation="vertical"
                  value={[band.gain]}
                  min={-12}
                  max={12}
                  step={0.5}
                  onValueChange={(val) => {
                    const v = Array.isArray(val) ? val[0] : val;
                    setBand(i, v);
                  }}
                  className="h-full"
                  disabled={!enabled}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{band.label}</span>
            </div>
          ))}
        </div>

        {/* 重置 */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetBands}
            className="cursor-pointer text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            重置
          </Button>
        </div>
      </div>
    </div>
  );
}

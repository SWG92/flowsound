"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCoverUrl } from "@/lib/utils";
import type { Song } from "@/lib/types";

interface SongInfoDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDuration(ms: number | undefined): string {
  if (typeof ms !== "number" || isNaN(ms) || ms < 0) return "--:--";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function SongInfoDialog({ song, open, onOpenChange }: SongInfoDialogProps) {
  if (!song) return null;

  const items = [
    { label: "歌曲名称", value: song.name },
    { label: "歌手", value: song.artists?.map((a) => a.name).join(" / ") },
    { label: "专辑", value: song.album?.name },
    { label: "时长", value: formatDuration(song.duration) },
    { label: "歌曲ID", value: String(song.id) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass">
        <DialogHeader>
          <DialogTitle>歌曲信息</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 items-start">
          {getCoverUrl(song) ? (
            <img
              src={getCoverUrl(song) + "?param=200y200"}
              alt={song.name}
              className="w-24 h-24 rounded-lg object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-muted/30 shrink-0" />
          )}
          <div className="flex-1 space-y-3">
            {items.map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium text-right max-w-[200px] truncate">
                  {item.value || "--"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

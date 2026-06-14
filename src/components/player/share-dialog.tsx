"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SHARE_LINK } from "@/lib/constants";
import { getCoverUrl } from "@/lib/utils";
import { logWarn } from "@/lib/logger";
import type { Song } from "@/lib/types";

interface ShareDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ song, open, onOpenChange }: ShareDialogProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const { showToast } = useToast();

  if (!song) return null;

  const link = SHARE_LINK(song.id);
  const text = `${song.name} - ${song.artists?.map((a) => a.name).join(" / ")}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showToast("链接已复制", "success");
    } catch (error) {
      logWarn("Failed to copy link:", error);
      showToast("复制失败，请检查浏览器权限", "error");
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
      showToast("歌曲信息已复制", "success");
    } catch (error) {
      logWarn("Failed to copy text:", error);
      showToast("复制失败，请检查浏览器权限", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass">
        <DialogHeader>
          <DialogTitle>分享歌曲</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            {getCoverUrl(song) && (
              <img
                src={getCoverUrl(song) + "?param=100y100"}
                alt={song.name}
                className="w-12 h-12 rounded object-cover"
              />
            )}
            <div>
              <p className="text-sm font-medium">{song.name}</p>
              <p className="text-xs text-muted-foreground">
                {song.artists?.map((a) => a.name).join(" / ")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">歌曲链接</p>
            <div className="flex gap-2">
              <div className="flex-1 p-2 rounded bg-muted/30 text-xs text-muted-foreground truncate">
                {link}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="cursor-pointer"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full cursor-pointer"
            onClick={handleCopyText}
          >
            {copiedText ? "已复制" : "复制歌曲名+链接"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

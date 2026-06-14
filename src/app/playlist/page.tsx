"use client";

import { useState } from "react";
import { ListMusic, Plus, Music2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SongList } from "@/components/playlist/song-list";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { STORAGE_KEYS } from "@/lib/constants";
import { logWarn } from "@/lib/logger";
import type { Song } from "@/lib/types";

interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  createdAt: number;
}

// 从 localStorage 加载歌单
function loadPlaylists(): Playlist[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.playlists) || "[]");
  } catch (error) {
    logWarn("Failed to load playlists:", error);
    return [];
  }
}

function savePlaylists(playlists: Playlist[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.playlists, JSON.stringify(playlists));
  } catch (error) {
    logWarn("Failed to save playlists:", error);
  }
}

export default function PlaylistPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { setQueue, playSong } = usePlayerStore();
  const { showToast } = useToast();

  const activePlaylist = playlists.find((p) => p.id === activeId);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: newName.trim(),
      songs: [],
      createdAt: Date.now(),
    };
    const updated = [...playlists, newPlaylist];
    savePlaylists(updated);
    setPlaylists(updated);
    setNewName("");
    setDialogOpen(false);
    showToast(`歌单「${newPlaylist.name}」已创建`, "success");
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    const deleted = playlists.find((p) => p.id === deleteId);
    const updated = playlists.filter((p) => p.id !== deleteId);
    savePlaylists(updated);
    setPlaylists(updated);
    if (activeId === deleteId) setActiveId(null);
    setDeleteId(null);
    if (deleted) {
      showToast(`歌单「${deleted.name}」已删除`, "info");
    }
  };

  const handlePlayAll = (songs: Song[]) => {
    if (songs.length === 0) return;
    setQueue(songs);
    playSong(songs[0], songs);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListMusic className="h-6 w-6 text-primary" />
            <span className="gradient-text">我的歌单</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            创建和管理你的歌单
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            新建歌单
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>新建歌单</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                placeholder="输入歌单名称..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Button
                onClick={handleCreate}
                className="w-full cursor-pointer"
                disabled={!newName.trim()}
              >
                创建
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activePlaylist ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{activePlaylist.name}</h2>
              <p className="text-sm text-muted-foreground">
                {activePlaylist.songs.length} 首歌曲
              </p>
            </div>
            <div className="flex gap-2">
              {activePlaylist.songs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePlayAll(activePlaylist.songs)}
                  className="cursor-pointer"
                >
                  播放全部
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveId(null)}
                className="cursor-pointer"
              >
                返回
              </Button>
            </div>
          </div>
          {activePlaylist.songs.length > 0 ? (
            <SongList songs={activePlaylist.songs} />
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Music2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">歌单还是空的</p>
              <p className="text-sm">搜索歌曲后添加到歌单</p>
            </div>
          )}
        </div>
      ) : playlists.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((playlist) => (
            <Card
              key={playlist.id}
              className="glass cursor-pointer hover:scale-[1.02] transition-transform relative group"
              onClick={() => setActiveId(playlist.id)}
            >
              <CardContent className="p-5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(playlist.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Music2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{playlist.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {playlist.songs.length} 首歌曲
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <ListMusic className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">还没有歌单</p>
          <p className="text-sm">点击上方按钮创建你的第一个歌单</p>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除歌单「{playlists.find((p) => p.id === deleteId)?.name}
            」吗？此操作不可撤销。
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteId(null)}
              className="cursor-pointer"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="cursor-pointer"
            >
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

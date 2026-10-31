"use client";

import { useState, useEffect, useMemo } from "react";
import { ListMusic, Plus, Music2, X, Pencil, Play, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SongList } from "@/components/playlist/song-list";
import { usePlayerStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { STORAGE_KEYS } from "@/lib/constants";
import { logWarn } from "@/lib/logger";
import { getCoverUrl } from "@/lib/utils";
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
  // 挂载后再读取 localStorage，避免 SSR/CSR 首帧不一致导致 hydration 报错
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // 歌单内搜索：歌单歌曲多时快速定位（按歌名/歌手/专辑匹配）
  const [search, setSearch] = useState("");
  // 只订阅用到的 action：播放进度等 store 变化不再引发歌单页重渲染
  const setQueue = usePlayerStore((s) => s.setQueue);
  const playSong = usePlayerStore((s) => s.playSong);
  const { showToast } = useToast();

  useEffect(() => {
    // 异步读取，避免同步 setState 触发级联渲染（react-hooks/set-state-in-effect）
    const t = setTimeout(() => setPlaylists(loadPlaylists()), 0);
    return () => clearTimeout(t);
  }, []);

  const activePlaylist = playlists.find((p) => p.id === activeId);

  // 搜索过滤：歌名/歌手/专辑任一命中即显示。
  // 搜索词在打开歌单卡片与返回列表时清空（不用 effect，规避级联渲染规则）
  const displaySongs = useMemo(() => {
    const base = activePlaylist?.songs ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.artists ?? []).some((a) => a.name.toLowerCase().includes(q)) ||
        (s.album?.name ?? "").toLowerCase().includes(q)
    );
  }, [activePlaylist, search]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    // 拒绝重名：主流播放器标准行为；同时天然阻断回车+点击连按造成的重复创建
    // （React 闭包里第二次点击仍读到未清空的旧名称，仅清空输入框拦不住）
    if (playlists.some((p) => p.name === name)) {
      showToast(`已有名为「${name}」的歌单`, "error");
      return;
    }
    const newPlaylist: Playlist = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      songs: [],
      createdAt: Date.now(),
    };
    const updated = [...playlists, newPlaylist];
    savePlaylists(updated);
    setPlaylists(updated);
    setNewName("");
    setDialogOpen(false);
    showToast(`歌单「${name}」已创建`, "success");
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
    playSong(songs[0], songs, songs);
  };

  // 从歌单移除歌曲（歌单详情页菜单）
  const handleRemoveFromPlaylist = (song: Song) => {
    if (!activePlaylist) return;
    const updated = playlists.map((p) =>
      p.id === activePlaylist.id
        ? { ...p, songs: p.songs.filter((s) => s.id !== song.id) }
        : p
    );
    savePlaylists(updated);
    setPlaylists(updated);
    showToast("已从歌单移除");
  };

  // 重命名歌单
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const handleRename = () => {
    if (!renameId || !renameName.trim()) return;
    const updated = playlists.map((p) =>
      p.id === renameId ? { ...p, name: renameName.trim() } : p
    );
    savePlaylists(updated);
    setPlaylists(updated);
    showToast(`已重命名为「${renameName.trim()}」`, "success");
    setRenameId(null);
    setRenameName("");
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
                {search.trim()
                  ? `${displaySongs.length} / ${activePlaylist.songs.length} 首歌曲`
                  : `${activePlaylist.songs.length} 首歌曲`}
              </p>
            </div>
            <div className="flex gap-2">
              {activePlaylist.songs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handlePlayAll(search.trim() ? displaySongs : activePlaylist.songs)
                  }
                  disabled={displaySongs.length === 0}
                  className="cursor-pointer"
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  播放全部
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRenameId(activePlaylist.id);
                  setRenameName(activePlaylist.name);
                }}
                className="cursor-pointer"
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                重命名
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveId(null);
                  setSearch("");
                }}
                className="cursor-pointer"
              >
                返回
              </Button>
            </div>
          </div>
          {/* 歌单内搜索：歌曲较多时快速定位 */}
          {activePlaylist.songs.length >= 10 && (
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="在歌单中搜索歌名、歌手、专辑..."
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="清空"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          {displaySongs.length > 0 ? (
            <SongList
              songs={displaySongs}
              virtual
              playlistId={activePlaylist.id}
              onRemoveFromPlaylist={handleRemoveFromPlaylist}
              // 搜索过滤视图下禁用拖拽排序：过滤后的索引与原数组错位
              onReorder={
                search.trim()
                  ? undefined
                  : (from, to) => {
                      const updated = playlists.map((p) => {
                        if (p.id !== activePlaylist.id) return p;
                        const reordered = [...p.songs];
                        const [moved] = reordered.splice(from, 1);
                        if (!moved) return p;
                        reordered.splice(to, 0, moved);
                        return { ...p, songs: reordered };
                      });
                      savePlaylists(updated);
                      setPlaylists(updated);
                    }
              }
            />
          ) : activePlaylist.songs.length > 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">没有匹配「{search.trim()}」的歌曲</p>
            </div>
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
              onClick={() => { setActiveId(playlist.id); setSearch(""); }}
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
                  {/* 歌单封面：用第一首歌的专辑封面，没有则回退图标 */}
                  {getCoverUrl(playlist.songs[0]) ? (
                    <img
                      src={getCoverUrl(playlist.songs[0]) + "?param=120y120"}
                      alt={playlist.name}
                      loading="lazy"
                      decoding="async"
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Music2 className="h-6 w-6 text-primary" />
                    </div>
                  )}
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

      {/* 重命名歌单弹窗 */}
      <Dialog open={!!renameId} onOpenChange={() => setRenameId(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>重命名歌单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="输入新的歌单名称..."
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
            <Button
              onClick={handleRename}
              className="w-full cursor-pointer"
              disabled={!renameName.trim()}
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

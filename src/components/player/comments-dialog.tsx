"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, ThumbsUp, Send, Loader2, Trash2, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import type { Song } from "@/lib/types";

const PAGE_SIZE = 50;

interface Comment {
  id: string;
  user: { nickname: string; avatarUrl: string };
  content: string;
  likedCount: number;
  time: number;
  isLocal?: boolean;
}

interface CommentsDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function loadLocalComments(songId: number): Comment[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(`fc_${songId}`) || "[]"); } catch { return []; }
}
function saveLocalComments(songId: number, c: Comment[]) { localStorage.setItem(`fc_${songId}`, JSON.stringify(c)); }
function loadLikes(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("fc_likes") || "{}"); } catch { return {}; }
}
function saveLikes(l: Record<string, boolean>) { localStorage.setItem("fc_likes", JSON.stringify(l)); }
function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 解析网易云评论内容，将 <img> 表情标签渲染为真实图片。
 * 仅允许 *.music.126.net 域名的 img 标签，其他 HTML 原样转义防 XSS。
 */
function CommentContent({ content }: { content: string }) {
  // 匹配网易云表情 img 标签：<img src="https://p?.music.126.net/..."/>
  const parts = content.split(/(<img\s+src="https:\/\/[^"]*music\.126\.net\/[^"]*"[^>]*\/?>)/g);

  return (
    <p className="text-sm mt-0.5 break-words leading-relaxed">
      {parts.map((part, i) => {
        const m = part.match(/^<img\s+src="(https:\/\/[^"]*music\.126\.net\/[^"]*)"[^>]*\/?>$/);
        if (m) {
          return (
            <img
              key={i}
              src={m[1]}
              alt="[表情]"
              className="inline-block align-text-bottom mx-0.5"
              style={{ width: 24, height: 24 }}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export function CommentsDialog({ song, open, onOpenChange }: CommentsDialogProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const offsetRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const { showToast } = useToast();

  // 加载评论
  const fetchComments = (songId: number, offset: number, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    fetch(`/api/music/comments?id=${songId}&limit=${PAGE_SIZE}&offset=${offset}`, {
      signal: abortRef.current?.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        const raw = data.hotComments || data.comments || [];
        const hasMoreRemote = (data.moreHot || data.more) ?? false;
        const totalRemote = data.total ?? 0;
        setHasMore(hasMoreRemote);
        if (totalRemote > 0) setTotal(totalRemote);

        if (!Array.isArray(raw) || raw.length === 0) {
          if (!append) setError("暂无评论，快来发表第一条吧");
          return;
        }
        const remote: Comment[] = raw.map((c: Record<string, unknown>) => ({
          id: String(c.commentId || ""),
          user: {
            nickname: String((c.user as Record<string, string>)?.nickname || "匿名"),
            avatarUrl: String((c.user as Record<string, string>)?.avatarUrl || ""),
          },
          content: String(c.content || ""),
          likedCount: Number(c.likedCount || 0),
          time: Number(c.time || 0),
        }));

        if (append) {
          setComments((prev) => [...prev, ...remote]);
        } else {
          const local = loadLocalComments(songId);
          const localIds = new Set(local.map((l) => l.id));
          setComments([...local, ...remote.filter((r) => !localIds.has(r.id))]);
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (!append) setError("加载评论失败");
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    if (!song || !open) return;
    if (abortRef.current) abortRef.current.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    offsetRef.current = 0;
    setError(null);
    setInput("");
    setLikedMap(loadLikes());

    fetchComments(song.id, 0);

    return () => controller.abort();
  }, [song, open]);

  // 加载更多
  const loadMore = () => {
    if (!song) return;
    offsetRef.current += PAGE_SIZE;
    fetchComments(song.id, offsetRef.current, true);
  };

  // 点赞
  const toggleLike = (commentId: string) => {
    const likes = loadLikes();
    if (likes[commentId]) {
      delete likes[commentId];
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, likedCount: Math.max(0, c.likedCount - 1) } : c));
    } else {
      likes[commentId] = true;
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, likedCount: c.likedCount + 1 } : c));
    }
    saveLikes(likes);
    setLikedMap(likes);
  };

  // 发送
  const handleSend = () => {
    if (!song || !input.trim()) return;
    setSending(true);
    const c: Comment = {
      id: `local_${Date.now()}`,
      user: { nickname: "我", avatarUrl: "" },
      content: input.trim(),
      likedCount: 0, time: Date.now(), isLocal: true,
    };
    const all = loadLocalComments(song.id);
    saveLocalComments(song.id, [c, ...all]);
    setComments((prev) => [c, ...prev]);
    setInput(""); setError(null); setSending(false);
    showToast("评论已发布");
  };

  // 删除
  const handleDelete = (commentId: string) => {
    if (!song) return;
    saveLocalComments(song.id, loadLocalComments(song.id).filter((c: Comment) => c.id !== commentId));
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    showToast("已删除");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-lg h-[78vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5" /> 评论
            {total > 0 && <span className="text-xs font-normal text-muted-foreground">({total.toLocaleString()}条)</span>}
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{song?.name} - {song?.artists?.map((a: {name: string}) => a.name).join(" / ")}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 min-h-0">
          {loading ? (
            <div className="space-y-4 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3"><Skeleton className="w-8 h-8 rounded-full bg-white/5 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-16 bg-white/5" /><Skeleton className="h-4 w-full bg-white/5" /></div></div>
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">{error}</div>
          ) : (
            <div className="space-y-3 py-2">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 group">
                  {c.user?.avatarUrl ? (
                    <img src={c.user.avatarUrl + "?param=50y50"} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">{(c.user?.nickname || "?")[0]}</span></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{c.user?.nickname || "匿名"}</span>
                      {c.isLocal && <span className="text-[10px] text-primary/60 bg-primary/10 px-1 rounded">我</span>}
                    </div>
                    <CommentContent content={c.content} />
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground/60">{formatTime(c.time)}</span>
                      <button onClick={() => toggleLike(c.id)} className={`flex items-center gap-0.5 text-[11px] transition-colors cursor-pointer ${likedMap[c.id] ? "text-red-400" : "text-muted-foreground/50 hover:text-muted-foreground"}`}>
                        <ThumbsUp className="h-3 w-3" fill={likedMap[c.id] ? "currentColor" : "none"} />{c.likedCount > 0 && <span>{c.likedCount}</span>}
                      </button>
                      {c.isLocal && (
                        <button onClick={() => handleDelete(c.id)} className="text-[10px] text-muted-foreground/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-0.5"><Trash2 className="h-3 w-3" />删除</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* 加载更多 */}
              {hasMore && (
                <button onClick={loadMore} disabled={loadingMore} className="w-full py-3 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center gap-1">
                  {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  {loadingMore ? "加载中..." : "加载更多评论"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-4 py-3 border-t border-white/5 flex items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }} placeholder="写下评论..." maxLength={500} className="flex-1 bg-white/5 rounded-full px-4 py-2 text-sm outline-none border border-white/5 focus:border-white/15 transition-colors placeholder:text-white/15" />
          <button onClick={handleSend} disabled={!input.trim() || sending} className="p-2 rounded-full bg-primary/80 hover:bg-primary text-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

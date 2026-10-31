"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/** 歌曲列表搜索框：受控组件，带清空按钮。
 * 建议列表 ≥10 首时才显示，避免小列表界面杂乱。 */
export function SongSearchInput({
  value,
  onChange,
  placeholder = "搜索歌名、歌手、专辑...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          title="清空"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** 歌曲列表搜索过滤：歌名/歌手/专辑任一命中即保留（不区分大小写） */
export function filterSongs<T extends { name: string; artists?: { name: string }[]; album?: { name?: string } }>(
  songs: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      (s.artists ?? []).some((a) => a.name.toLowerCase().includes(q)) ||
      (s.album?.name ?? "").toLowerCase().includes(q)
  );
}

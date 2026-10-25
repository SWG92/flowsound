import type { Song } from "./types";

/**
 * 服务端出口裁剪：上游（网易云/QQ/酷狗）的 Song 对象带大量客户端用不到的字段
 * （h/b/m/l 各档音质详情、版权、碟号、mvid、多语言别名、歌手简介等），
 * 榜单 50 首的响应实测约 1.2MB，裁剪后约 100~150KB——手机流量下首屏明显更快。
 * 客户端 Song 类型只用：id/name/artists(id,name)/album(id,name,picUrl)/duration/fee/url/platform/platformId
 */
export function slimSong<T extends Song>(s: T): Song {
  return {
    id: s.id,
    name: s.name,
    artists: (s.artists || []).map((a) => ({ id: a.id, name: a.name })),
    album: s.album
      ? { id: s.album.id, name: s.album.name, picUrl: s.album.picUrl }
      : { id: 0, name: "", picUrl: "" },
    duration: s.duration,
    fee: s.fee,
    url: s.url,
    platform: s.platform,
    platformId: s.platformId,
  };
}

export function slimSongs<T extends Song>(songs: T[]): Song[] {
  return songs.map(slimSong);
}

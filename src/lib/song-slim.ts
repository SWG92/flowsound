import type { Song } from "./types";
import type { AudioQuality } from "./constants";

/**
 * 从网易云歌曲对象的音质档字段（bMusic/lMusic=128K / mMusic=192K / hMusic=320K /
 * sqMusic=无损 / hrMusic=Hi-Res，歌单/歌手/专辑接口的命名；song/detail 用 l/h 简写）
 * 生成该歌实际可用的音质列表。
 *
 * fee 语义（网易云官方）：0=完全免费，1=VIP（已在出口过滤），8=非会员可播低音质。
 * 实测 fee=8 的歌匿名请求 128K/320K 正常（standard/exhigh）、请求无损必降级 exhigh
 * ——即匿名最高 320K。因此 fee=8 直接不显示无损档，菜单天生只含真正可选的音质。
 * 搜索接口不返回这些字段 → qualities 为 undefined，客户端菜单不过滤（回退显示全部）。
 */
function extractQualities(song: Song): AudioQuality[] | undefined {
  const ext = song as unknown as Record<string, { id?: number } | undefined>;
  const low = ext.lMusic || ext.bMusic || ext.l || ext.b;
  const high = ext.hMusic || ext.h;
  const lossless = ext.sqMusic || ext.sq || ext.hrMusic || ext.hr;
  if (!low && !high && !lossless) return undefined;
  const q: AudioQuality[] = [];
  if (low) q.push("smooth", "standard"); // 96K/128K 同走低档资源
  if (high) q.push("high");
  // fee=8：无损档需会员，匿名不可选，不显示
  if (lossless && song.fee !== 8) q.push("lossless");
  return q;
}

/**
 * 服务端出口裁剪：上游（网易云/QQ/酷狗）的 Song 对象带大量客户端用不到的字段
 * （h/b/m/l 各档音质详情、版权、碟号、mvid、多语言别名、歌手简介等），
 * 榜单 50 首的响应实测约 1.2MB，裁剪后约 100~150KB——手机流量下首屏明显更快。
 * 音质档信息转换为 qualities 数组保留（音质菜单按实际可用档过滤显示）。
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
    // 已算好的优先（搜索适配器在补封面时生成），否则从原始音质字段计算
    qualities: s.qualities ?? extractQualities(s),
  };
}

export function slimSongs<T extends Song>(songs: T[]): Song[] {
  return songs.map(slimSong);
}

export { extractQualities };

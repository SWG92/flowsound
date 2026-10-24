// 服务端内存缓存：对上游音乐平台（网易云/QQ/酷狗）的响应按 TTL 缓存。
// 上游有限流（网易云限流时抽样约半数取址返回空），命中缓存可绕过；
// 多客户端/多页面重复请求同一资源时也只回源一次。
// 单实例内存缓存：next start 单进程下全局共享；serverless 部署时每个实例各自生效。
type Entry = { data: unknown; expiresAt: number };

const MAX_ENTRIES = 300;
const store = new Map<string, Entry>();

export function getServerCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setServerCache(key: string, data: unknown, ttlMs: number) {
  if (store.size >= MAX_ENTRIES) {
    // 淘汰最早插入的条目（Map 迭代按插入序），防止长驻进程内存无限增长
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** 由请求参数构造缓存键（键排序保证参数顺序不影响命中）。
 * netease 是缺省平台：带不带 platform=netease 的同一请求解析结果相同，键也须相同 */
export function serverCacheKey(fn: string, params: Record<string, string>): string {
  const parts = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .filter((p) => p !== "_platform=netease");
  return `${fn}?${parts.join("&")}`;
}

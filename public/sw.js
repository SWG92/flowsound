// FlowSound Service Worker — 离线缓存关键资源
const CACHE_NAME = "flowsound-v1";

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg",
];

// 安装：预缓存关键资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求拦截：缓存优先策略
self.addEventListener("fetch", (event) => {
  // 跳过 API 请求和跨域请求
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request)
    )
  );
});

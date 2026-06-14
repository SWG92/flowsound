// FlowSound Service Worker
const CACHE_NAME = "flowsound-v2";

// 安装
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// 激活
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求拦截：仅缓存静态资源，API 和 HTML 请求直接放行
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 不拦截 API、HMR、HTML 请求
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    event.request.mode === "navigate"
  ) {
    return;
  }

  // 仅缓存静态资源
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});

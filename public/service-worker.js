const CACHE_NAME = "KNOTES_CACHE_V1";
const CORE_ASSETS = [
  "/",
  "/offline",
  "/icons/web-app-manifest-192x192.png",
  "/icons/web-app-manifest-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    cache.put(request, res.clone());
    return res;
  } catch (e) {
    if (request.mode === "navigate") {
      return caches.match("/offline");
    }
    throw e;
  }
}

async function networkFirstJSON(request) {
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, res.clone());
      return res;
    }
    throw new Error("Network not ok");
  } catch (e) {
    // Fallback to cache for previously seen JSON/API
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin or navigation requests
  if (request.mode === "navigate") {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Handle JSON/API with network-first
  if (request.headers.get("accept")?.includes("application/json")) {
    event.respondWith(networkFirstJSON(request));
    return;
  }

  // Static assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("message", (event) => {
  if (event && event.data === "SKIP_WAITING") self.skipWaiting();
});

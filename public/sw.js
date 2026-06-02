// ============================================================
//  Service Worker — Sievert EyC PWA
//  Estrategia: Shell caching + Network-first para navegación
//  Los datos viven en IndexedDB (Dexie), no necesitan cache HTTP
// ============================================================

const CACHE_NAME = "sievert-eyc-v1";

// Assets del app shell que se pre-cachean en install
const APP_SHELL = [
  "/",
  "/dashboard",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/logo-sievert.png",
];

// ─── Install: pre-cachear app shell ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Pre-caching app shell");
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: limpiar caches viejos ───
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log("[SW] Removing old cache:", key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: estrategia por tipo de request ───
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar requests del mismo origen
  if (url.origin !== location.origin) return;

  // No cachear requests POST ni API
  if (request.method !== "GET") return;

  // Navegación (HTML) → Network-first con fallback a cache
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Assets estáticos (JS, CSS, imágenes, fuentes) → Cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request));
    return;
  }

  // Todo lo demás → Network-first
  event.respondWith(networkFirstWithFallback(request));
});

// ─── Estrategias de caching ───

async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline y no en cache — devolver respuesta genérica
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback: devolver la página principal cacheada o la página offline
    if (request.mode === "navigate") {
      const fallback = await caches.match("/dashboard");
      if (fallback) return fallback;

      const offlinePage = await caches.match("/offline.html");
      if (offlinePage) return offlinePage;
    }

    return new Response("Offline", { status: 503 });
  }
}

// ─── Helpers ───

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|ico)$/.test(
    pathname
  );
}

// ─── Skip Waiting (activar nueva versión) ───
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ─── Background Sync ───
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-data") {
    console.log("[SW] Background sync triggered — sync-pending-data");
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "SYNC_REQUESTED" });
        }
      })
    );
  }
});

// ─── Push Notifications (preparado para futuro) ───
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? "Sievert EyC";
  const options = {
    body: data.body ?? "Tienes una actualización",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url ?? "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// sw.js
const SHELL_CACHE = "pokedex-shell-v3";
const API_CACHE = "pokedex-api-v1";
const MAX_API_ENTRIES = 120;

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles/main.css",
  "./styles/retro-ui.css",
  "./styles/themes.css",
  "./styles/animations.css",
  "./js/app.js",
  "./js/api.js",
  "./js/ui.js",
  "./js/team.js",
  "./js/minigame.js",
  "./js/scanner.js",
  "./js/utils.js",
  "./icons/pokedex-icon-192.png",
  "./icons/pokedex-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Precache skipped for: ${asset}`, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== SHELL_CACHE && key !== API_CACHE) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    trimCache(cacheName, maxItems);
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 1. Cross-origin PokéAPI cache
  if (url.origin.includes("pokeapi.co")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
            trimCache(API_CACHE, MAX_API_ENTRIES);
          }
          return networkResponse;
        } catch {
          const cached = await cache.match(event.request.url, { ignoreSearch: true });
          if (cached) return cached;
          return new Response(JSON.stringify({ error: "Offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
      })
    );
    return;
  }

  // 2. Navigation & Static Assets: Network-First with Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request.url, { ignoreSearch: true });
        if (cached) return cached;

        if (event.request.mode === "navigate") {
          const shellFallback =
            (await caches.match("./index.html")) ||
            (await caches.match("/index.html")) ||
            (await caches.match("./")) ||
            (await caches.match("/"));
          if (shellFallback) return shellFallback;
        }

        return new Response("Resource unavailable offline", { status: 503 });
      })
  );
});
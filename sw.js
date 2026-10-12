// sw.js
const CACHE_NAME = 'pokedex-shell-v1';

// Cache only core static layout files during install
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles/main.css',
  './styles/retro-ui.css',
  './styles/themes.css',
  './styles/animations.css',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Network-first strategy: Always fetch live from internet
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

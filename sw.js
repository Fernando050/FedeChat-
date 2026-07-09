const CACHE_NAME = 'fedchat-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js'
];

// Enstale Service Worker la epi sove fichye yo nan kach (Cache)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Netwaye ansyen kach si gen yon nouvo vèsyon
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Repon ak fichye ki nan kach la pou app a ka rapid
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

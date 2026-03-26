const CACHE_NAME = 'sagrada-v1.2.0';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './js/state.js',
  './js/ui.js',
  './js/cardManager.js',
  './js/utils.js',
  './js/i18n.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

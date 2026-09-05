const CACHE_NAME = 'focus-v14';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './js/app.js',
  './js/router.js',
  './js/db.js',
  './js/store.js',
  './js/parser.js',
  './js/ai.js',
  './js/components/navbar.js',
  './js/components/modal.js',
  './js/components/toast.js',
  './js/views/home.js',
  './js/views/chat.js',
  './js/views/agenda.js',
  './js/views/altro.js',
  './js/views/spesa.js',
  './js/views/dispensa.js',
  './js/views/finanze.js',
  './js/views/settings.js',
  './js/notifications.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(cls => {
      if (cls.length > 0) {
        cls[0].focus();
      } else {
        clients.openWindow('./');
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});

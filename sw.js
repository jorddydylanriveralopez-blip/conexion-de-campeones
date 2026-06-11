const CACHE_NAME = 'yaavs-pwa-v10';

const urlsToCache = [
  './',
  './index.html',
  './styles_vf.css?v=20260611_logo_enter',
  './script_vf.js?v=20260611_logo_enter'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', event => {
  let data = { title: 'YAAVS', body: 'Tienes un aviso.', url: 'https://ganayaavs.com' };
  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        data = Object.assign(data, parsed);
      }
    } catch (e) {
      const t = event.data.text();
      if (t) {
        data.body = t;
      }
    }
  }
  const iconUrl = 'https://assets.zyrosite.com/EnigzBPrgZr5GxnU/mesa-de-trabajo-23-8-9UuOY2sWU5il4Fc7.png';
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: iconUrl,
      badge: iconUrl,
      data: { url: data.url || 'https://ganayaavs.com' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || 'https://ganayaavs.com';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

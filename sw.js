const CACHE = 'prep-and-rate-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-512.png',
  './icons/logo-lockup.png',
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache local assets reliably; best-effort on CDN assets
      return cache.addAll(['./index.html', './manifest.json', './icons/icon-512.png', './icons/logo-lockup.png']).then(() => {
        return Promise.allSettled(ASSETS.filter(a => !a.startsWith('.')).map(url =>
          fetch(url, { mode: 'no-cors' }).then(r => cache.put(url, r)).catch(() => {})
        ));
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // For API calls to Anthropic, always go network-only
  if (e.request.url.includes('anthropic.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

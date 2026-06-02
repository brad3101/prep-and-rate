const CACHE = 'prep-and-rate-v4';

// These are always fetched fresh from network — never served stale from cache
const NETWORK_FIRST = ['./index.html', './', './icons/logo-lockup.png'];

// CDN assets — cache aggressively, they don't change
const CDN_ASSETS = [
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache static assets; CDN best-effort
      cache.addAll(['./manifest.json', './icons/icon-512.png']);
      return Promise.allSettled(CDN_ASSETS.map(url =>
        fetch(url, { mode: 'no-cors' }).then(r => cache.put(url, r)).catch(() => {})
      ));
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
  const url = new URL(e.request.url);
  const path = url.pathname;

  // Anthropic API — always network only
  if (e.request.url.includes('anthropic.com')) return;

  // Network-first for HTML and frequently updated assets
  const isNetworkFirst = NETWORK_FIRST.some(p => path.endsWith(p.replace('./', '/'))) || path === '/';
  if (isNetworkFirst) {
    e.respondWith(
      fetch(e.request).then(response => {
        // Update cache with fresh copy
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match(e.request)) // Fall back to cache when offline
    );
    return;
  }

  // Cache-first for everything else (CDN libs, icons, fonts)
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

const CACHE = 'north-splash-os-v80-phone';
const SHELL = ['./', './index.html', './manifest.webmanifest', './ns-auto-luxe-mark.png', './ns-auto-luxe-logo.png', './ns-auto-luxe-full-logo.png', './ns-auto-luxe-watermark.svg', './icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function offlinePage() {
  return caches.match('./index.html').then((cached) => cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isPage = req.mode === 'navigate' || req.destination === 'document';
  if (isPage) {
    event.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return r;
        })
        .catch(() => offlinePage())
    );
    return;
  }

  if (['script', 'style'].includes(req.destination)) {
    event.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return r;
        })
        .catch(() => caches.match(req).then((cached) => cached || offlinePage()))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((r) => {
          if (r.ok && ['image', 'font'].includes(req.destination)) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return r;
        })
        .catch(() => caches.match(req).then((hit) => hit || new Response('', { status: 504 })));
    })
  );
});

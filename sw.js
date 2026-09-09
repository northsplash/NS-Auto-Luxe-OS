const CACHE = 'north-splash-os-v122-emails';
const SHELL = ['./', './index.html', './manifest.webmanifest', './ns-auto-luxe-mark.png', './ns-auto-luxe-logo.png', './ns-auto-luxe-full-logo.png', './ns-auto-luxe-watermark.svg', './icon-192.png', './og-image.png', './favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function isAssetRequest(url) {
  return /\.(?:js|mjs|css|map|woff2?|png|jpe?g|gif|svg|webp|ico)$/i.test(url.pathname) || url.pathname.startsWith('/assets/');
}

function looksLikeHtml(response) {
  const type = response.headers.get('content-type') || '';
  return type.includes('text/html');
}

function missingAsset() {
  return new Response('/* missing asset */', {
    status: 404,
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
  });
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
          if (r.ok && looksLikeHtml(r)) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return r;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })))
    );
    return;
  }

  if (['script', 'style', 'worker'].includes(req.destination) || isAssetRequest(url)) {
    event.respondWith(
      fetch(req)
        .then((r) => {
          if (!r.ok || looksLikeHtml(r)) return missingAsset();
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req).then((cached) => {
          if (cached && !looksLikeHtml(cached)) return cached;
          return missingAsset();
        }))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached && !looksLikeHtml(cached)) return cached;
      return fetch(req)
        .then((r) => {
          if (r.ok && ['image', 'font'].includes(req.destination) && !looksLikeHtml(r)) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return r;
        })
        .catch(() => caches.match(req).then((hit) => hit || new Response('', { status: 504 })));
    })
  );
});

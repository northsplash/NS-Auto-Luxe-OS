const CACHE='north-splash-os-v8';
const SHELL=['/','/index.html','/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put('/index.html',copy));return r}).catch(()=>caches.match('/index.html')));return;
  }
  // App code is network-first so fresh deployments do not get trapped behind an old PWA cache.
  if(['script','style'].includes(req.destination)){
    event.respondWith(fetch(req).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return r}).catch(()=>caches.match(req)));return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(r=>{if(r.ok&&['image','font'].includes(req.destination)){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return r})));
});

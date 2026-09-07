const RELOAD_KEY = 'ns-stale-chunk-reload-v85';

export function isStaleChunkError(message?: string | null) {
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|not a valid JavaScript MIME type|Expected a JavaScript module but the server responded with a MIME type|Failed to load module script/i.test(String(message || ''));
}

async function clearAppCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch { /* keep clearing */ }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch { /* private mode */ }
}

export function recoverStaleChunkOnce() {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === '1') return false;
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    /* private mode — still try one reload */
  }
  const reload = () => {
    const next = new URL(window.location.href);
    next.searchParams.set('_ns', String(Date.now()));
    window.location.replace(next.toString());
  };
  void clearAppCaches().finally(reload);
  return true;
}

export function installStaleChunkRecovery() {
  if (typeof window === 'undefined') return;
  window.addEventListener('unhandledrejection', (event) => {
    const message = String((event.reason as { message?: string } | undefined)?.message || event.reason || '');
    if (isStaleChunkError(message) && recoverStaleChunkOnce()) {
      event.preventDefault();
    }
  });
  window.addEventListener('error', (event) => {
    const message = String(event.message || (event as ErrorEvent).error?.message || '');
    if (isStaleChunkError(message) && recoverStaleChunkOnce()) {
      event.preventDefault();
    }
  }, true);
}

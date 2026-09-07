const RELOAD_KEY = 'ns-stale-chunk-reload-v78';

export function isStaleChunkError(message?: string | null) {
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(String(message || ''));
}

export function recoverStaleChunkOnce() {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === '1') return false;
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    /* private mode — still try one reload */
  }
  const reload = () => window.location.reload();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
      .catch(() => undefined)
      .finally(reload);
  } else {
    reload();
  }
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
}

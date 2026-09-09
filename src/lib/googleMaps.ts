declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
    __northSplashGoogleMapsPromise?: Promise<any>;
    __northSplashGoogleMapsBroken?: boolean;
    __nsGmAuthHooked?: boolean;
  }
}

export const GOOGLE_MAPS_API_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
export const GOOGLE_MAPS_MAP_ID = String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '').trim();
/** Lead / territory maps use Google whenever a Maps JavaScript key is in the build. */
export const GOOGLE_MAPS_ENABLED = Boolean(GOOGLE_MAPS_API_KEY);

/** Hide Google's extra camera / street-view / type widgets. We draw our own search and Map / Satellite / Hybrid. */
export const GOOGLE_MAP_CHROME = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  rotateControl: false,
  scaleControl: false,
  cameraControl: false,
  clickableIcons: true,
  keyboardShortcuts: false,
} as const;

const BROKEN_KEY = 'ns-google-maps-auth-failed-v2';
const authListeners = new Set<() => void>();

export function googleMapsUnavailable() {
  if (typeof window === 'undefined') return false;
  if (window.__northSplashGoogleMapsBroken) return true;
  try {
    return sessionStorage.getItem(BROKEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function shouldUseGoogleMaps() {
  return GOOGLE_MAPS_ENABLED && !googleMapsUnavailable();
}

export function markGoogleMapsUnavailable() {
  if (typeof window === 'undefined') return;
  window.__northSplashGoogleMapsBroken = true;
  try { sessionStorage.setItem(BROKEN_KEY, '1'); } catch { /* ignore */ }
  authListeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

export function onGoogleMapsAuthFailure(fn: () => void) {
  authListeners.add(fn);
  if (googleMapsUnavailable()) queueMicrotask(fn);
  return () => { authListeners.delete(fn); };
}

function installAuthFailureHook() {
  if (typeof window === 'undefined' || window.__nsGmAuthHooked) return;
  window.__nsGmAuthHooked = true;
  const previous = window.gm_authFailure;
  window.gm_authFailure = () => {
    try { previous?.(); } catch { /* ignore */ }
    markGoogleMapsUnavailable();
  };
}

installAuthFailureHook();

function hasGoogleErrorOverlay(root?: ParentNode | null) {
  if (!root) return false;
  return Boolean(root.querySelector?.('.gm-err-container, .gm-err-content'));
}

function hasGoogleDevWatermark(root?: ParentNode | null) {
  if (!root || typeof (root as HTMLElement).querySelectorAll !== 'function') return false;
  const el = root as HTMLElement;
  const sample = `${el.innerText || ''} ${el.textContent || ''}`.slice(0, 80000);
  if (/for development purposes only/i.test(sample)) return true;
  return Array.from(el.querySelectorAll('div, span')).slice(0, 400).some((node) =>
    /for development purposes only/i.test(node.textContent || '')
  );
}

export function googleMapsLooksBroken(root?: ParentNode | null) {
  return hasGoogleErrorOverlay(root) || hasGoogleErrorOverlay(document.body) || hasGoogleDevWatermark(root) || hasGoogleDevWatermark(document.body);
}

export function watchGoogleMapError(root: HTMLElement | null, onFail: () => void) {
  if (!root) return () => {};
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    markGoogleMapsUnavailable();
    onFail();
  };
  if (googleMapsUnavailable() || googleMapsLooksBroken(root) || googleMapsLooksBroken(document.body)) {
    queueMicrotask(fire);
    return () => {};
  }
  const scan = () => {
    if (googleMapsLooksBroken(root) || googleMapsLooksBroken(document.body)) fire();
  };
  const observer = new MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true });
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = window.setTimeout(scan, 1800);
  const later = window.setTimeout(scan, 4500);
  const unsub = onGoogleMapsAuthFailure(fire);
  return () => {
    observer.disconnect();
    window.clearTimeout(timer);
    window.clearTimeout(later);
    unsub();
  };
}

export function loadGoogleMaps(): Promise<any> {
  installAuthFailureHook();
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('GOOGLE_MAPS_API_KEY_MISSING'));
  if (googleMapsUnavailable()) return Promise.reject(new Error('GOOGLE_MAPS_AUTH_FAILURE'));
  if (window.google?.maps && !googleMapsUnavailable()) return Promise.resolve(window.google);
  if (window.__northSplashGoogleMapsPromise) return window.__northSplashGoogleMapsPromise;
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('GOOGLE_MAPS_API_KEY_MISSING'));

  window.__northSplashGoogleMapsPromise = new Promise((resolve, reject) => {
    const fail = (error: Error) => {
      window.__northSplashGoogleMapsPromise = undefined;
      if (error.message === 'GOOGLE_MAPS_AUTH_FAILURE') markGoogleMapsUnavailable();
      reject(error);
    };

    const previous = window.gm_authFailure;
    window.gm_authFailure = () => {
      try { previous?.(); } catch { /* ignore */ }
      fail(new Error('GOOGLE_MAPS_AUTH_FAILURE'));
    };

    const finish = () => {
      if (googleMapsUnavailable()) {
        fail(new Error('GOOGLE_MAPS_AUTH_FAILURE'));
        return;
      }
      if (window.google?.maps) resolve(window.google);
      else fail(new Error('GOOGLE_MAPS_LOAD_FAILED'));
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-ns-google-maps="true"]');
    if (existing) {
      const timer = window.setInterval(() => {
        if (googleMapsUnavailable()) {
          window.clearInterval(timer);
          fail(new Error('GOOGLE_MAPS_AUTH_FAILURE'));
        } else if (window.google?.maps) {
          window.clearInterval(timer);
          window.setTimeout(finish, 350);
        }
      }, 75);
      window.setTimeout(() => {
        window.clearInterval(timer);
        if (!window.google?.maps) fail(new Error('GOOGLE_MAPS_LOAD_TIMEOUT'));
      }, 15000);
      return;
    }

    const callbackName = `__northSplashGoogleMapsReady_${Date.now()}`;
    const cleanup = () => {
      try { delete (window as any)[callbackName]; } catch { (window as any)[callbackName] = undefined; }
    };
    (window as any)[callbackName] = () => {
      cleanup();
      window.setTimeout(finish, 350);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places,geometry,marker&v=weekly&loading=async&callback=${encodeURIComponent(callbackName)}`;
    script.async = true;
    script.defer = true;
    script.dataset.nsGoogleMaps = 'true';
    script.onerror = () => {
      cleanup();
      fail(new Error('GOOGLE_MAPS_LOAD_FAILED'));
    };
    window.setTimeout(() => {
      if (!window.google?.maps && !googleMapsUnavailable()) {
        cleanup();
        fail(new Error('GOOGLE_MAPS_LOAD_TIMEOUT'));
      }
    }, 20000);
    document.head.appendChild(script);
  });

  return window.__northSplashGoogleMapsPromise;
}

export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<string> {
  const google = await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  const results = await new Promise<any[]>((resolve, reject) => {
    geocoder.geocode({ location: { lat, lng } }, (res: any[] | null, status: string) => {
      if (status === 'OK' && res?.length) resolve(res);
      else reject(new Error(status || 'ZERO_RESULTS'));
    });
  });
  return String(results[0]?.formatted_address || '');
}

export function googleMapsErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : String(error || '');
  if (code === 'GOOGLE_MAPS_DISABLED' || code === 'GOOGLE_MAPS_API_KEY_MISSING') return 'Add VITE_GOOGLE_MAPS_API_KEY on Vercel (Maps JavaScript API, Geocoding, Places, Distance Matrix). The map stays on OpenStreetMap until that key is in the build.';
  if (code === 'GOOGLE_MAPS_AUTH_FAILURE') return 'Google Maps rejected this key. Check billing, HTTP-referrer restrictions, and that Maps JavaScript API and Distance Matrix API are enabled.';
  if (code === 'GOOGLE_MAPS_LOAD_TIMEOUT') return 'Google Maps timed out while loading. Check the API key restrictions and enabled APIs.';
  return 'Google Maps could not load. The street map stays on so canvassing can continue.';
}

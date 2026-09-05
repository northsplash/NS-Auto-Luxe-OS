declare global {
  interface Window {
    google?: any;
    __northSplashGoogleMapsPromise?: Promise<any>;
  }
}

export const GOOGLE_MAPS_API_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
export const GOOGLE_MAPS_MAP_ID = String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '').trim();

export function loadGoogleMaps(): Promise<any> {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (window.__northSplashGoogleMapsPromise) return window.__northSplashGoogleMapsPromise;
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('GOOGLE_MAPS_API_KEY_MISSING'));

  window.__northSplashGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-ns-google-maps="true"]');
    if (existing) {
      const timer = window.setInterval(() => {
        if (window.google?.maps) {
          window.clearInterval(timer);
          resolve(window.google);
        }
      }, 75);
      window.setTimeout(() => {
        window.clearInterval(timer);
        if (!window.google?.maps) reject(new Error('GOOGLE_MAPS_LOAD_TIMEOUT'));
      }, 15000);
      return;
    }

    const callbackName = `__northSplashGoogleMapsReady_${Date.now()}`;
    const cleanup = () => {
      try { delete (window as any)[callbackName]; } catch { (window as any)[callbackName] = undefined; }
    };
    (window as any)[callbackName] = () => {
      if (window.google?.maps) {
        cleanup();
        resolve(window.google);
      } else {
        cleanup();
        reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
      }
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places,geometry,marker&v=weekly&loading=async&callback=${encodeURIComponent(callbackName)}`;
    script.async = true;
    script.defer = true;
    script.dataset.nsGoogleMaps = 'true';
    script.onerror = () => {
      cleanup();
      reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
    };
    window.setTimeout(() => {
      if (!window.google?.maps) {
        cleanup();
        reject(new Error('GOOGLE_MAPS_LOAD_TIMEOUT'));
      }
    }, 20000);
    document.head.appendChild(script);
  });

  return window.__northSplashGoogleMapsPromise;
}

export function googleMapsErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : String(error || '');
  if (code === 'GOOGLE_MAPS_API_KEY_MISSING') return 'Google Maps is ready in the OS code, but VITE_GOOGLE_MAPS_API_KEY has not been added in Vercel yet.';
  if (code === 'GOOGLE_MAPS_LOAD_TIMEOUT') return 'Google Maps timed out while loading. Check the API key restrictions and enabled APIs.';
  return 'Google Maps could not load. Check Vercel environment variables, Google API restrictions, and billing.';
}

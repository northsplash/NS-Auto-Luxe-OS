import { SR_STATUSES, doorStatusKey, type DoorStatus } from './salesRabbitLeads';

export type { DoorStatus };

export const DOOR_STATUSES: Array<{key: DoorStatus; label: string; short: string; color: string; priority: number}> = SR_STATUSES.map((s) => ({
  key: s.key,
  label: s.name,
  short: s.abbr,
  color: s.color,
  priority: s.priority,
}));

export const doorStatus = (value?: string | null) =>
  DOOR_STATUSES.find(item => item.key === doorStatusKey(value)) ?? DOOR_STATUSES[0];

export const CONTACTED_STATUSES = new Set<DoorStatus>([
  'contacted','interested','follow_up','estimate','appointment_set','sold','customer','not_interested','do_not_knock','cancelled','lost'
]);
export const APPOINTMENT_STATUSES = new Set<DoorStatus>(['appointment_set','sold','customer']);
export const SOLD_STATUSES = new Set<DoorStatus>(['sold','customer']);
export const UNWORKED_STATUSES = new Set<DoorStatus>(['unworked']);
export const REVISIT_STATUSES = new Set<DoorStatus>(['no_answer','revisit','follow_up']);

export type GeoPoint = { latitude: number; longitude: number; id?: string; status?: string; address?: string | null };

export function haversineMeters(a: GeoPoint, b: GeoPoint) {
  const r = 6371000;
  const rad = (v: number) => v * Math.PI / 180;
  const p1 = rad(a.latitude), p2 = rad(b.latitude);
  const dp = rad(b.latitude - a.latitude), dl = rad(b.longitude - a.longitude);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * Fast field-sales route planner. This intentionally uses a deterministic
 * nearest-neighbor pass so it works instantly on-device and offline. It is
 * not a turn-by-turn road-network optimizer; the Navigate action still opens
 * the device's mapping app for actual directions.
 */
export function optimizeWalkingRoute<T extends GeoPoint>(start: GeoPoint, stops: T[]) {
  const remaining = [...stops];
  const ordered: T[] = [];
  let cursor = start;
  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    remaining.forEach((stop, index) => {
      const distance = haversineMeters(cursor, stop);
      // Field priority matters, but distance is still the dominant signal so the
      // rep does not zig-zag across a neighborhood for a single high-value door.
      const priorityBoost = Math.max(0, doorStatus(stop.status).priority - 30) * 2.25;
      const score = distance - priorityBoost;
      if (score < bestScore) { bestScore = score; bestIndex = index; }
    });
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    cursor = next;
  }

  // A small deterministic 2-opt pass removes obvious route crossings while
  // remaining fast enough to run locally/offline on an iPad for a few hundred doors.
  const route = [...ordered];
  const maxPasses = route.length > 350 ? 1 : route.length > 180 ? 2 : 3;
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (let i = 0; i < route.length - 2; i++) {
      const a: GeoPoint = i === 0 ? start : route[i - 1];
      const b = route[i];
      for (let k = i + 1; k < route.length - 1; k++) {
        const c = route[k], d = route[k + 1];
        const before = haversineMeters(a, b) + haversineMeters(c, d);
        const after = haversineMeters(a, c) + haversineMeters(b, d);
        if (after + 2 < before) {
          route.splice(i, k - i + 1, ...route.slice(i, k + 1).reverse());
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return route;
}

export function rankNextBestHouse<T extends GeoPoint>(start: GeoPoint, stops: T[]) {
  return [...stops].sort((a, b) => {
    const score = (door: T) => {
      const distance = haversineMeters(start, door);
      const priority = doorStatus(door.status).priority;
      return distance - Math.max(0, priority - 30) * 2.5;
    };
    return score(a) - score(b);
  });
}

export function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return '—';
  const feet = meters * 3.28084;
  if (feet < 1320) return `${Math.max(1, Math.round(feet))} ft`;
  const miles = meters / 1609.344;
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

export function localDateKey(value?: string | Date | null) {
  const d = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sameLocalDay(value?: string | null, date = new Date()) {
  if (!value) return false;
  return localDateKey(value) === localDateKey(date);
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0,0,0,0);
  return d;
}

export function localTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString('en-US', {hour:'numeric',minute:'2-digit'}) : '—';
}

export function localDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('en-US', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—';
}

export function normalizePhone(value?: string | null) {
  return (value || '').replace(/\D/g, '').slice(-10);
}

export function normalizeAddress(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/\s+/g,' ').replace(/[.,#]/g,'');
}

export function buildAppleMapsUrl(lat?: number | null, lng?: number | null, address?: string | null) {
  if (lat != null && lng != null) return `https://maps.apple.com/?daddr=${encodeURIComponent(`${lat},${lng}`)}`;
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address || '')}`;
}

export function buildGoogleMapsUrl(lat?: number | null, lng?: number | null, address?: string | null) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : address || '';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

export function telHref(phone?: string | null) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits.length >= 7 ? `tel:${digits}` : '';
}

export function smsHref(phone?: string | null, body?: string) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (digits.length < 7) return '';
  if (!body) return `sms:${digits}`;
  const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return `sms:${digits}${ios ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

export async function copyText(value: string) {
  const text = String(value || '').trim();
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function percent(value: number, total: number) {
  return total > 0 ? Math.min(100, Math.round(value / total * 100)) : 0;
}

export function doorStreetLabel(
  door?: {
    address?: string | null;
    house_number?: string | null;
    street_name?: string | null;
  } | null,
  fallback = 'Mapped house',
) {
  if (!door) return fallback;
  const composed = [door.house_number, door.street_name].filter(Boolean).join(' ').trim();
  const address = String(door.address || '').trim();
  if (address && !/^address pending$/i.test(address)) return address;
  return composed || fallback;
}

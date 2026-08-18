export type DoorStatus =
  | 'unworked'
  | 'no_answer'
  | 'revisit'
  | 'contacted'
  | 'interested'
  | 'follow_up'
  | 'estimate'
  | 'appointment_set'
  | 'sold'
  | 'customer'
  | 'not_interested'
  | 'do_not_knock'
  | 'cancelled'
  | 'lost';

export const DOOR_STATUSES: Array<{key: DoorStatus; label: string; short: string; color: string; priority: number}> = [
  { key: 'unworked', label: 'Unworked', short: 'Unworked', color: '#c8c0b8', priority: 30 },
  { key: 'no_answer', label: 'No Answer', short: 'No Answer', color: '#d39a45', priority: 90 },
  { key: 'revisit', label: 'Revisit', short: 'Revisit', color: '#c68b54', priority: 100 },
  { key: 'contacted', label: 'Contacted', short: 'Contacted', color: '#8b735d', priority: 60 },
  { key: 'interested', label: 'Interested', short: 'Interested', color: '#78935d', priority: 120 },
  { key: 'follow_up', label: 'Follow Up', short: 'Follow Up', color: '#6f8f8a', priority: 140 },
  { key: 'estimate', label: 'Estimate', short: 'Estimate', color: '#a27c47', priority: 150 },
  { key: 'appointment_set', label: 'Appointment Set', short: 'Appointment', color: '#9d7651', priority: 160 },
  { key: 'sold', label: 'Sold', short: 'Sold', color: '#5f7f61', priority: 170 },
  { key: 'customer', label: 'Customer', short: 'Customer', color: '#426c4b', priority: 175 },
  { key: 'not_interested', label: 'Not Interested', short: 'Not Interested', color: '#995f55', priority: 10 },
  { key: 'do_not_knock', label: 'Do Not Knock', short: 'DNK', color: '#241d18', priority: 0 },
  { key: 'cancelled', label: 'Cancelled', short: 'Cancelled', color: '#8d5e58', priority: 20 },
  { key: 'lost', label: 'Lost', short: 'Lost', color: '#725d55', priority: 15 },
];

export const doorStatus = (value?: string | null) =>
  DOOR_STATUSES.find(item => item.key === value) ?? DOOR_STATUSES[0];

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

export function sameLocalDay(value?: string | null, date = new Date()) {
  if (!value) return false;
  const d = new Date(value);
  return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
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

export function percent(value: number, total: number) {
  return total > 0 ? Math.min(100, Math.round(value / total * 100)) : 0;
}

import { doorStatus, doorStreetLabel, percent, type DoorStatus } from '@/lib/fieldOps';
import { doorStatusKey } from '@/lib/salesRabbitLeads';
import type { FieldDoor } from '@/components/FieldTerritoryMap.types';
import type { Lead, TerritoryDoor } from '@/lib/supabase';

/** One-tap field dispositions. Extra catalog statuses stay in filters/history. */
export const CANVASS_KNOCK_KEYS: DoorStatus[] = [
  'unworked',
  'no_answer',
  'revisit',
  'interested',
  'follow_up',
  'estimate',
  'appointment_set',
  'sold',
  'do_not_knock',
];

export const CANVASS_FILTER_KEYS: DoorStatus[] = [
  'unworked',
  'no_answer',
  'revisit',
  'interested',
  'follow_up',
  'estimate',
  'appointment_set',
  'sold',
  'do_not_knock',
];

export const CLOSE_AFTER_KNOCK = new Set<string>([
  'unworked', 'no_answer', 'revisit', 'do_not_knock', 'not_interested', 'cancelled', 'lost',
]);

export const NEEDS_TIME_KEYS = new Set<string>(['appointment_set', 'follow_up']);

export type MapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom?: number;
};

export type CanvassRenderItem =
  | { type: 'door'; door: FieldDoor }
  | { type: 'cluster'; lat: number; lng: number; count: number; color: string };

export type TerritoryCanvassStats = {
  total: number;
  worked: number;
  remaining: number;
  contacted: number;
  interested: number;
  followUps: number;
  estimates: number;
  appointments: number;
  sales: number;
  conversion: number;
  revenue: number;
  progress: number;
};

const CONTACTED = new Set([
  'contacted', 'interested', 'follow_up', 'estimate', 'appointment_set', 'sold', 'customer',
  'not_interested', 'do_not_knock', 'cancelled', 'lost',
]);

export function escapeHtml(value: string) {
  return String(value || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] || c
  ));
}

export function houseMarkerSvg(color: string, opts?: { selected?: boolean; dim?: boolean }) {
  const safe = /^#[0-9a-f]{6}$/i.test(color) ? color : '#7d8ea3';
  const selected = Boolean(opts?.selected);
  const dim = Boolean(opts?.dim);
  const opacity = dim ? 0.34 : 1;
  const stroke = selected ? '#1c1612' : '#fffdf8';
  const strokeW = selected ? 2.4 : 1.55;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="26" viewBox="0 0 28 32" aria-hidden="true">
    <path d="M14 2.4 26.2 12.6v16.8H1.8V12.6Z" fill="${safe}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
    <rect x="11.1" y="18.2" width="5.8" height="10.8" rx=".7" fill="${stroke}" fill-opacity="${dim ? 0.45 : 0.94}"/>
  </svg>`;
}

export function houseMarkerDataUrl(color: string, opts?: { selected?: boolean; dim?: boolean }) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(houseMarkerSvg(color, opts))}`;
}

export function houseMarkerHtml(
  door: FieldDoor,
  opts?: {
    selected?: boolean;
    dim?: boolean;
    route?: number;
    assignedName?: string;
    lastActivity?: string;
  },
) {
  const status = door.do_not_knock ? doorStatus('do_not_knock') : doorStatus(door.status);
  const address = escapeHtml(doorStreetLabel(door, 'Mapped house'));
  const assigned = escapeHtml(opts?.assignedName || 'Unassigned');
  const last = escapeHtml(opts?.lastActivity || 'No activity yet');
  const dim = opts?.dim ? ' dim' : '';
  const sel = opts?.selected ? ' selected' : '';
  const route = opts?.route ? `<em class="ns-house-route">${opts.route}</em>` : '';
  return `<span class="ns-house-pin${sel}${dim}" style="--pin:${status.color}">
    ${houseMarkerSvg(status.color, opts)}
    ${route}
    <span class="ns-house-hover-card">
      <strong>${address}</strong>
      <span class="ns-house-hover-status" style="--pin:${status.color}">${escapeHtml(status.label)}</span>
      <small>${last}</small>
      <small>${assigned}</small>
    </span>
  </span>`;
}

export function clusterMarkerHtml(count: number, color: string) {
  return `<span class="ns-house-cluster" style="--pin:${color}"><b>${count > 99 ? '99+' : count}</b></span>`;
}

export function doorsInBounds<T extends { latitude?: number | null; longitude?: number | null }>(
  doors: T[],
  bounds: MapBounds | null,
  pad = 0.18,
): T[] {
  if (!bounds) return doors;
  const latPad = Math.max(0.0004, (bounds.north - bounds.south) * pad);
  const lngPad = Math.max(0.0004, (bounds.east - bounds.west) * pad);
  const south = bounds.south - latPad;
  const north = bounds.north + latPad;
  const west = bounds.west - lngPad;
  const east = bounds.east + lngPad;
  return doors.filter((d) => {
    const lat = Number(d.latitude);
    const lng = Number(d.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= south && lat <= north && lng >= west && lng <= east;
  });
}

export function doorMatchesSearch(door: FieldDoor, query: string, customerName?: string | null) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${door.address || ''} ${door.house_number || ''} ${door.street_name || ''} ${customerName || ''} ${door.status || ''}`.toLowerCase().includes(q);
}

export function clusterCanvassDoors(doors: FieldDoor[], zoom = 16): CanvassRenderItem[] {
  if (zoom >= 16.2 || doors.length < 90) return doors.map((door) => ({ type: 'door', door }));
  const cell = zoom >= 15 ? 0.0014 : zoom >= 13.5 ? 0.0028 : zoom >= 12 ? 0.006 : zoom >= 10 ? 0.014 : 0.032;
  const buckets = new Map<string, FieldDoor[]>();
  for (const door of doors) {
    const lat = Number(door.latitude);
    const lng = Number(door.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = `${Math.round(lat / cell)}_${Math.round(lng / cell)}`;
    const list = buckets.get(key);
    if (list) list.push(door);
    else buckets.set(key, [door]);
  }
  const items: CanvassRenderItem[] = [];
  for (const group of buckets.values()) {
    if (group.length < 3) {
      group.forEach((door) => items.push({ type: 'door', door }));
      continue;
    }
    const lat = group.reduce((n, d) => n + Number(d.latitude), 0) / group.length;
    const lng = group.reduce((n, d) => n + Number(d.longitude), 0) / group.length;
    items.push({ type: 'cluster', lat, lng, count: group.length, color: doorStatus(group[0]?.status).color });
  }
  return items;
}

export function canvassTerritoryStats(
  doors: Array<Pick<TerritoryDoor, 'status' | 'do_not_knock'>>,
  leads: Array<Pick<Lead, 'id' | 'status' | 'estimated_value' | 'actual_sale_amount' | 'territory_door_id'>> = [],
  sales: Array<{ sale_amount?: number | null; status?: string | null }> = [],
): TerritoryCanvassStats {
  const total = doors.length;
  const worked = doors.filter((d) => doorStatusKey(d.status) !== 'unworked').length;
  const remaining = Math.max(0, total - worked);
  const contacted = doors.filter((d) => CONTACTED.has(doorStatusKey(d.status))).length;
  const interested = doors.filter((d) => doorStatusKey(d.status) === 'interested').length;
  const followUps = doors.filter((d) => ['follow_up', 'revisit'].includes(doorStatusKey(d.status))).length;
  const estimates = doors.filter((d) => doorStatusKey(d.status) === 'estimate').length;
  const appointments = doors.filter((d) => doorStatusKey(d.status) === 'appointment_set').length;
  const salesCount = doors.filter((d) => ['sold', 'customer'].includes(doorStatusKey(d.status))).length;
  const fromSales = sales.filter((s) => (s.status || 'completed') === 'completed').reduce((n, s) => n + Number(s.sale_amount || 0), 0);
  const fromLeads = leads.reduce((n, l) => n + Number(l.actual_sale_amount || 0), 0);
  const revenue = fromSales || fromLeads;
  return {
    total,
    worked,
    remaining,
    contacted,
    interested,
    followUps,
    estimates,
    appointments,
    sales: salesCount,
    conversion: percent(salesCount, Math.max(contacted, 1)),
    revenue,
    progress: percent(worked, total),
  };
}

export function formatRelativeActivity(value?: string | null) {
  if (!value) return 'No activity yet';
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return 'No activity yet';
  const delta = Date.now() - then;
  if (delta < 45_000) return 'Just now';
  if (delta < 3_600_000) return `${Math.max(1, Math.round(delta / 60_000))} min ago`;
  if (delta < 86_400_000) return `${Math.max(1, Math.round(delta / 3_600_000))} hr ago`;
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function applyCanvasFullscreen(active: boolean) {
  document.documentElement.classList.toggle('ns-canvas-fs', active);
  document.body.classList.toggle('ns-canvas-fs', active);
  document.querySelectorAll('.portal-layout').forEach((node) => node.classList.toggle('ns-canvas-fs', active));
}

export function doorIsDimmed(door: FieldDoor, filters: string[]) {
  if (!filters.length) return false;
  return !filters.includes(door.do_not_knock ? 'do_not_knock' : (door.status || 'unworked'));
}

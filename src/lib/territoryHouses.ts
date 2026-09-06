import { supabase } from '@/lib/supabase';

export const TERRITORY_MAX_AREA = 0.15;

const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const BLOCKED_BUILDINGS = new Set([
  'commercial', 'industrial', 'warehouse', 'retail', 'office', 'school',
  'hospital', 'church', 'civic', 'public', 'government', 'garage', 'garages', 'shed',
]);

export type OsmHouseElement = {
  type?: string;
  id?: number | string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export type OsmHouse = {
  lat: number;
  lng: number;
  address: string | null;
  house_number: string | null;
  street_name: string | null;
  source: string;
  tags: Record<string, string>;
};

export type TerritoryBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
  points?: [number, number][];
  residentialOnly?: boolean;
};

/** Even-odd test. Polygon vertices are `[lat, lng]`, matching Phase 300 / D2D conversion from GeoJSON. */
export function pointInPolygon(lat: number, lng: number, polygon: number[][]) {
  if (!polygon?.length) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = Number(polygon[i][0]);
    const xi = Number(polygon[i][1]);
    const yj = Number(polygon[j][0]);
    const xj = Number(polygon[j][1]);
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function boundsFromPoints(points: [number, number][]): Omit<TerritoryBounds, 'points'> {
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs),
  };
}

export function parseBbox(bbox: string): Omit<TerritoryBounds, 'points'> {
  const [south, west, north, east] = bbox.split(',').map(Number);
  return { south, west, north, east };
}

function assertBounds({ south, west, north, east }: TerritoryBounds) {
  if (![south, west, north, east].every(Number.isFinite)) throw new Error('Invalid territory bounds.');
  const area = (north - south) * (east - west);
  if (area <= 0) throw new Error('Invalid territory bounds.');
  if (area > TERRITORY_MAX_AREA) throw new Error('Territory is too large. Draw a smaller neighborhood area.');
}

function overpassQuery(b: TerritoryBounds) {
  return `[out:json][timeout:18];(way["building"](${b.south},${b.west},${b.north},${b.east});node["addr:housenumber"](${b.south},${b.west},${b.north},${b.east}););out center tags;`;
}

function isTooLarge(message: string) {
  return /too large/i.test(message);
}

async function fetchOverpassDirect(bounds: TerritoryBounds): Promise<OsmHouseElement[]> {
  const q = overpassQuery(bounds);
  let last = 'House discovery providers are busy.';
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const ctl = new AbortController();
      const timer = window.setTimeout(() => ctl.abort(), 22000);
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=UTF-8' },
        body: q,
        signal: ctl.signal,
      });
      window.clearTimeout(timer);
      if (!r.ok) {
        last = `Provider returned ${r.status}`;
        continue;
      }
      const json = await r.json();
      const poly = (bounds.points || []).filter((p) => Array.isArray(p) && p.length === 2);
      return (json.elements || []).filter((e: OsmHouseElement) => {
        const lat = Number(e.lat ?? e.center?.lat);
        const lon = Number(e.lon ?? e.center?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
        return poly.length < 3 || pointInPolygon(lat, lon, poly);
      });
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`House discovery is temporarily unavailable. ${last}`);
}

export async function fetchTerritoryHouses(bounds: TerritoryBounds): Promise<OsmHouseElement[]> {
  assertBounds(bounds);
  const body = {
    south: bounds.south,
    west: bounds.west,
    north: bounds.north,
    east: bounds.east,
    points: bounds.points || [],
  };
  try {
    const { data, error } = await supabase.functions.invoke('territory-house-search', { body });
    const message = String(data?.error || error?.message || '');
    if (isTooLarge(message)) throw new Error(message || 'Territory is too large. Draw a smaller neighborhood area.');
    if (!error && data?.success && Array.isArray(data.elements)) return data.elements;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || '');
    if (isTooLarge(message)) throw err;
  }
  return fetchOverpassDirect(bounds);
}

export function mapOsmHouses(
  elements: OsmHouseElement[] | null | undefined,
  polygon?: number[][],
  opts?: { residentialOnly?: boolean },
): OsmHouse[] {
  const poly = (polygon || []).filter((p) => Array.isArray(p) && p.length >= 2);
  const rows: OsmHouse[] = [];
  for (const e of elements || []) {
    const lat = Number(e.lat ?? e.center?.lat);
    const lng = Number(e.lon ?? e.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (poly.length >= 3 && !pointInPolygon(lat, lng, poly)) continue;
    const tags = e.tags || {};
    if (opts?.residentialOnly) {
      const building = String(tags.building || '').toLowerCase();
      if (building && BLOCKED_BUILDINGS.has(building)) continue;
    }
    const house = String(tags['addr:housenumber'] || '').trim();
    const street = String(tags['addr:street'] || '').trim();
    const address = [house, street].filter(Boolean).join(' ') || null;
    rows.push({
      lat,
      lng,
      address,
      house_number: house || null,
      street_name: street || null,
      source: `osm:${e.type || 'node'}:${e.id ?? `${lat},${lng}`}`,
      tags,
    });
  }
  return rows;
}

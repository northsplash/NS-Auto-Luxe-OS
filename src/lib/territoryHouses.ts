import { supabase } from '@/lib/supabase';

export const TERRITORY_MAX_AREA = 0.15;

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

function isTooLarge(message: string) {
  return /too large/i.test(message);
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
  let last = 'House discovery is temporarily unavailable.';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('territory-house-search', { body });
      const message = String(data?.error || error?.message || '');
      if (isTooLarge(message)) throw new Error(message || 'Territory is too large. Draw a smaller neighborhood area.');
      if (!error && data?.success && Array.isArray(data.elements)) return data.elements;
      last = message || last;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || '');
      if (isTooLarge(message)) throw err;
      last = message || last;
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw new Error(`${last} Mapped houses already imported stay saved until an owner refreshes this territory.`);
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

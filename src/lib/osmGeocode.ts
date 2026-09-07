export type OsmPlace = {
  lat: number;
  lng: number;
  label: string;
  south?: number;
  north?: number;
  west?: number;
  east?: number;
};

const HEADERS = { 'Accept-Language': 'en-US,en' };

function parseHit(hit: any): OsmPlace | null {
  const lat = Number(hit?.lat);
  const lng = Number(hit?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const bbox = Array.isArray(hit.boundingbox) ? hit.boundingbox.map(Number) : [];
  return {
    lat,
    lng,
    label: String(hit.display_name || ''),
    south: Number.isFinite(bbox[0]) ? bbox[0] : undefined,
    north: Number.isFinite(bbox[1]) ? bbox[1] : undefined,
    west: Number.isFinite(bbox[2]) ? bbox[2] : undefined,
    east: Number.isFinite(bbox[3]) ? bbox[3] : undefined,
  };
}

export async function searchOsmPlace(query: string): Promise<OsmPlace | null> {
  const q = query.trim();
  if (!q) return null;
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`,
    { headers: HEADERS },
  );
  if (!response.ok) return null;
  const rows = await response.json();
  return parseHit(Array.isArray(rows) ? rows[0] : null);
}

export async function geocodeOsmAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const place = await searchOsmPlace(address);
  return place ? { lat: place.lat, lng: place.lng } : null;
}

export function osmPropertyUrl(opts: { lat?: number | null; lng?: number | null; query?: string | null }) {
  const lat = Number(opts.lat);
  const lng = Number(opts.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`;
  }
  const query = String(opts.query || '').trim();
  if (query) return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
  return '';
}

export function osmDirectionsUrl(opts: { lat?: number | null; lng?: number | null; query?: string | null }) {
  const lat = Number(opts.lat);
  const lng = Number(opts.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${lat}%2C${lng}`;
  }
  return osmPropertyUrl(opts);
}

import type { Appointment } from '@/lib/supabase';
import { haversineMeters } from '@/lib/fieldOps';
import { loadGoogleMaps, shouldUseGoogleMaps } from '@/lib/googleMaps';
import { geocodeOsmAddress } from '@/lib/osmGeocode';

export const DEFAULT_TRAVEL_BUFFER_MINUTES = 30;
export const MIN_TRAVEL_BUFFER_MINUTES = 15;
export const MAX_TRAVEL_BUFFER_MINUTES = 90;
export const TRAVEL_STEP_MINUTES = 15;

export type GeoCoord = { lat: number; lng: number; address?: string };
export type DriveEstimate = {
  minutes: number;
  miles: number;
  source: 'traffic' | 'duration' | 'haversine' | 'fallback';
  label: string;
};

const driveCache = new Map<string, DriveEstimate>();
const geocodeCache = new Map<string, GeoCoord | null>();

export function roundTravelMinutes(raw: number) {
  if (!Number.isFinite(raw) || raw <= 0) return MIN_TRAVEL_BUFFER_MINUTES;
  const stepped = Math.ceil(raw / TRAVEL_STEP_MINUTES) * TRAVEL_STEP_MINUTES;
  return Math.min(MAX_TRAVEL_BUFFER_MINUTES, Math.max(MIN_TRAVEL_BUFFER_MINUTES, stepped));
}

export function driveMinutesFromMiles(miles: number) {
  const padded = (Math.max(0, miles) / 22) * 60 + 6;
  return padded;
}

export function validCoord(lat?: number | null, lng?: number | null): lat is number {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && !(Number(lat) === 0 && Number(lng) === 0);
}

export function appointmentCoord(a: Appointment | null | undefined): GeoCoord | null {
  if (!a) return null;
  if (validCoord(a.latitude, a.longitude)) {
    return { lat: Number(a.latitude), lng: Number(a.longitude), address: a.service_address || undefined };
  }
  return null;
}

export async function resolveCoord(input: { lat?: number | null; lng?: number | null; address?: string | null }): Promise<GeoCoord | null> {
  if (validCoord(input.lat, input.lng)) {
    return { lat: Number(input.lat), lng: Number(input.lng), address: input.address || undefined };
  }
  const address = String(input.address || '').trim();
  if (!address) return null;
  const key = address.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key) || null;

  let resolved: GeoCoord | null = null;
  if (shouldUseGoogleMaps()) {
    try {
      const google = await loadGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      const results = await new Promise<any[]>((resolve, reject) => {
        geocoder.geocode({ address, componentRestrictions: { country: 'US' } }, (res: any[] | null, status: string) => {
          if (status === 'OK' && res?.length) resolve(res);
          else reject(new Error(status || 'ZERO_RESULTS'));
        });
      });
      const loc = results[0]?.geometry?.location;
      const lat = typeof loc?.lat === 'function' ? loc.lat() : Number(loc?.lat);
      const lng = typeof loc?.lng === 'function' ? loc.lng() : Number(loc?.lng);
      if (validCoord(lat, lng)) resolved = { lat, lng, address: results[0]?.formatted_address || address };
    } catch {
      resolved = null;
    }
  }
  if (!resolved) {
    const osm = await geocodeOsmAddress(address).catch(() => null);
    if (osm && validCoord(osm.lat, osm.lng)) resolved = { lat: osm.lat, lng: osm.lng, address };
  }
  geocodeCache.set(key, resolved);
  return resolved;
}

function cacheKey(origin: GeoCoord, dest: GeoCoord, hour: number) {
  return `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|${dest.lat.toFixed(4)},${dest.lng.toFixed(4)}|${hour}`;
}

function haversineEstimate(origin: GeoCoord, dest: GeoCoord): DriveEstimate {
  const meters = haversineMeters(
    { latitude: origin.lat, longitude: origin.lng },
    { latitude: dest.lat, longitude: dest.lng },
  );
  const miles = meters / 1609.34;
  const minutes = roundTravelMinutes(driveMinutesFromMiles(miles));
  return {
    minutes,
    miles,
    source: 'haversine',
    label: `${minutes} min drive · ${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi (road estimate)`,
  };
}

async function matrixEstimate(origin: GeoCoord, dest: GeoCoord, departureAt: Date): Promise<DriveEstimate | null> {
  if (!shouldUseGoogleMaps()) return null;
  try {
    const google = await loadGoogleMaps();
    const service = new google.maps.DistanceMatrixService();
    const leave = departureAt.getTime() < Date.now() ? new Date() : departureAt;
    const response = await new Promise<any>((resolve, reject) => {
      service.getDistanceMatrix({
        origins: [{ lat: origin.lat, lng: origin.lng }],
        destinations: [{ lat: dest.lat, lng: dest.lng }],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
        drivingOptions: {
          departureTime: leave,
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      }, (res: any, status: string) => {
        if (status === 'OK') resolve(res);
        else reject(new Error(status || 'DISTANCE_MATRIX_FAILED'));
      });
    });
    const element = response?.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') return null;
    const trafficSec = Number(element.duration_in_traffic?.value);
    const durationSec = Number(element.duration?.value);
    const meters = Number(element.distance?.value || 0);
    const miles = meters / 1609.34;
    const seconds = Number.isFinite(trafficSec) && trafficSec > 0 ? trafficSec : durationSec;
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const minutes = roundTravelMinutes(seconds / 60);
    const traffic = Number.isFinite(trafficSec) && trafficSec > 0;
    return {
      minutes,
      miles,
      source: traffic ? 'traffic' : 'duration',
      label: traffic
        ? `${minutes} min with traffic · ${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`
        : `${minutes} min drive · ${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`,
    };
  } catch {
    return null;
  }
}

export async function estimateDriveBuffer(opts: {
  origin?: { lat?: number | null; lng?: number | null; address?: string | null } | null;
  destination?: { lat?: number | null; lng?: number | null; address?: string | null } | null;
  departureAt?: Date | null;
}): Promise<DriveEstimate> {
  const fallback: DriveEstimate = {
    minutes: DEFAULT_TRAVEL_BUFFER_MINUTES,
    miles: 0,
    source: 'fallback',
    label: `${DEFAULT_TRAVEL_BUFFER_MINUTES} min default buffer`,
  };
  const [origin, dest] = await Promise.all([
    opts.origin ? resolveCoord(opts.origin) : Promise.resolve(null),
    opts.destination ? resolveCoord(opts.destination) : Promise.resolve(null),
  ]);
  if (!origin || !dest) return fallback;
  const miles = haversineMeters(
    { latitude: origin.lat, longitude: origin.lng },
    { latitude: dest.lat, longitude: dest.lng },
  ) / 1609.34;
  if (miles < 0.08) {
    return { minutes: MIN_TRAVEL_BUFFER_MINUTES, miles, source: 'haversine', label: `${MIN_TRAVEL_BUFFER_MINUTES} min · same neighborhood` };
  }
  const hour = (opts.departureAt || new Date()).getHours();
  const key = cacheKey(origin, dest, hour);
  const cached = driveCache.get(key);
  if (cached) return cached;
  const matrix = await matrixEstimate(origin, dest, opts.departureAt || new Date());
  const estimate = matrix || haversineEstimate(origin, dest);
  driveCache.set(key, estimate);
  return estimate;
}

import type { Lead, LeadTerritory } from '@/lib/supabase';

export type FieldDoor = {
  id?: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  house_number?: string | null;
  street_name?: string | null;
  status?: string;
  territory_id?: string | null;
  lead_id?: string | null;
  do_not_knock?: boolean;
  source?: string | null;
  last_visited_at?: string | null;
  last_employee_id?: string | null;
  customer_name?: string | null;
  assigned_name?: string | null;
};

export type MapViewportBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom?: number;
};

export type FieldTerritoryMapProps = {
  territories: LeadTerritory[];
  leads?: Lead[];
  doors?: FieldDoor[];
  editable?: boolean;
  selectedTerritoryId?: string;
  initialPolygon?: [number, number][];
  onPolygonChange?: (points: [number, number][]) => void;
  onDoorClick?: (door: FieldDoor) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onTerritoryClick?: (territory: LeadTerritory) => void;
  liveLocation?: { latitude: number; longitude: number; accuracy?: number | null } | null;
  routeDoorIds?: string[];
  activeDoorId?: string | null;
  statusFilter?: string[];
  /** Dim unmatched houses instead of removing them from the map. */
  filterMode?: 'dim' | 'hide';
  showDoorLabels?: boolean;
  className?: string;
  autoFit?: boolean;
  mobileGestureLock?: boolean;
  fieldMode?: boolean;
  searchQuery?: string;
  onViewportChange?: (bounds: MapViewportBounds) => void;
};

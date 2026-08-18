import type { Lead, LeadTerritory } from '@/lib/supabase';

export type FieldDoor = {
  id?: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  status?: string;
  territory_id?: string | null;
  lead_id?: string | null;
  do_not_knock?: boolean;
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
  showDoorLabels?: boolean;
  className?: string;
  autoFit?: boolean;
  mobileGestureLock?: boolean;
  fieldMode?: boolean;
};

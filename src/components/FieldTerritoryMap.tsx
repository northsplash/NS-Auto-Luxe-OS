import { useState } from 'react';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMaps';
import FieldTerritoryMapLegacy from './FieldTerritoryMapLegacy';
import FieldTerritoryMapModern from './FieldTerritoryMapModern';
import type { FieldTerritoryMapProps } from './FieldTerritoryMap.types';
export type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

export default function FieldTerritoryMap(props: FieldTerritoryMapProps) {
  const [engine, setEngine] = useState<'google' | 'leaflet'>(GOOGLE_MAPS_API_KEY ? 'google' : 'leaflet');
  if (engine === 'google') {
    return <FieldTerritoryMapModern {...props} onUnavailable={() => setEngine('leaflet')} />;
  }
  return <FieldTerritoryMapLegacy {...props} />;
}

import { useState } from 'react';
import { GOOGLE_MAPS_API_KEY, googleMapsErrorMessage } from '@/lib/googleMaps';
import FieldTerritoryMapLegacy from './FieldTerritoryMapLegacy';
import FieldTerritoryMapModern from './FieldTerritoryMapModern';
import type { FieldTerritoryMapProps } from './FieldTerritoryMap.types';
export type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

export default function FieldTerritoryMap(props: FieldTerritoryMapProps) {
  const { className = '', ...rest } = props;
  const [engine, setEngine] = useState<'google' | 'leaflet'>(GOOGLE_MAPS_API_KEY ? 'google' : 'leaflet');
  const [fallbackReason, setFallbackReason] = useState(GOOGLE_MAPS_API_KEY ? '' : googleMapsErrorMessage('GOOGLE_MAPS_API_KEY_MISSING'));
  const map = engine === 'google'
    ? <FieldTerritoryMapModern {...rest} onUnavailable={() => { setFallbackReason(googleMapsErrorMessage('GOOGLE_MAPS_LOAD_FAILED')); setEngine('leaflet'); }} />
    : <FieldTerritoryMapLegacy {...rest} />;
  return (
    <div className={`ns-map-shell ${className}`}>
      {engine === 'leaflet' && fallbackReason && (
        <div className="ns-map-fallback">Street map is on. Add a Google Maps key in Vercel for satellite pins.</div>
      )}
      {map}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { googleMapsErrorMessage, onGoogleMapsAuthFailure, shouldUseGoogleMaps } from '@/lib/googleMaps';
import FieldTerritoryMapLegacy from './FieldTerritoryMapLegacy';
import FieldTerritoryMapModern from './FieldTerritoryMapModern';
import type { FieldTerritoryMapProps } from './FieldTerritoryMap.types';
export type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

export default function FieldTerritoryMap(props: FieldTerritoryMapProps) {
  const { className = '', ...rest } = props;
  const [engine, setEngine] = useState<'google' | 'leaflet'>(shouldUseGoogleMaps() ? 'google' : 'leaflet');
  const [fallbackReason, setFallbackReason] = useState(shouldUseGoogleMaps() ? '' : googleMapsErrorMessage('GOOGLE_MAPS_DISABLED'));

  useEffect(() => {
    return onGoogleMapsAuthFailure(() => {
      setFallbackReason(googleMapsErrorMessage('GOOGLE_MAPS_AUTH_FAILURE'));
      setEngine('leaflet');
    });
  }, []);

  const dropToLeaflet = () => {
    setFallbackReason(googleMapsErrorMessage('GOOGLE_MAPS_AUTH_FAILURE'));
    setEngine('leaflet');
  };

  const map = engine === 'google'
    ? <FieldTerritoryMapModern {...rest} onUnavailable={dropToLeaflet} />
    : <FieldTerritoryMapLegacy {...rest} />;
  return (
    <div className={`ns-map-shell ${className}`}>
      {engine === 'leaflet' && fallbackReason && (
        <div className="ns-map-fallback">OpenStreetMap is on. Search an address, then click the map to draw the neighborhood.</div>
      )}
      {map}
    </div>
  );
}

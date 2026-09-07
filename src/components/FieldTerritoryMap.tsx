import { useEffect, useState } from 'react';
import { GOOGLE_MAPS_API_KEY, googleMapsErrorMessage, googleMapsUnavailable, onGoogleMapsAuthFailure } from '@/lib/googleMaps';
import FieldTerritoryMapLegacy from './FieldTerritoryMapLegacy';
import FieldTerritoryMapModern from './FieldTerritoryMapModern';
import type { FieldTerritoryMapProps } from './FieldTerritoryMap.types';
export type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

export default function FieldTerritoryMap(props: FieldTerritoryMapProps) {
  const { className = '', ...rest } = props;
  const [engine, setEngine] = useState<'google' | 'leaflet'>(GOOGLE_MAPS_API_KEY && !googleMapsUnavailable() ? 'google' : 'leaflet');
  const [fallbackReason, setFallbackReason] = useState(GOOGLE_MAPS_API_KEY && !googleMapsUnavailable() ? '' : googleMapsErrorMessage(GOOGLE_MAPS_API_KEY ? 'GOOGLE_MAPS_AUTH_FAILURE' : 'GOOGLE_MAPS_API_KEY_MISSING'));

  useEffect(() => {
    return onGoogleMapsAuthFailure(() => {
      setFallbackReason(googleMapsErrorMessage('GOOGLE_MAPS_AUTH_FAILURE'));
      setEngine('leaflet');
    });
  }, []);

  const dropToLeaflet = () => {
    setFallbackReason(googleMapsErrorMessage(googleMapsUnavailable() ? 'GOOGLE_MAPS_AUTH_FAILURE' : 'GOOGLE_MAPS_LOAD_FAILED'));
    setEngine('leaflet');
  };

  const map = engine === 'google'
    ? <FieldTerritoryMapModern {...rest} onUnavailable={dropToLeaflet} />
    : <FieldTerritoryMapLegacy {...rest} />;
  return (
    <div className={`ns-map-shell ${className}`}>
      {engine === 'leaflet' && fallbackReason && (
        <div className="ns-map-fallback">Street map is on. Google Maps is not available on this site yet.</div>
      )}
      {map}
    </div>
  );
}

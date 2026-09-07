import { useState } from 'react';
import FieldTerritoryMapLegacy from './FieldTerritoryMapLegacy';
import FieldTerritoryMapModern from './FieldTerritoryMapModern';
import { shouldUseGoogleMaps } from '@/lib/googleMaps';
import type { FieldTerritoryMapProps } from './FieldTerritoryMap.types';
export type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

export default function FieldTerritoryMap(props: FieldTerritoryMapProps) {
  const { className = '', ...rest } = props;
  const [engine, setEngine] = useState<'google' | 'osm'>(() => (shouldUseGoogleMaps() ? 'google' : 'osm'));
  return (
    <div className={`ns-map-shell ${className}`}>
      {engine === 'google' ? (
        <FieldTerritoryMapModern {...rest} onUnavailable={() => setEngine('osm')} />
      ) : (
        <FieldTerritoryMapLegacy {...rest} />
      )}
    </div>
  );
}

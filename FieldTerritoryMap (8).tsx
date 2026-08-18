import { useEffect, useState } from 'react';
import FieldTerritoryMapLegacy from './FieldTerritoryMapLegacy';
import FieldTerritoryMapModern from './FieldTerritoryMapModern';
import type { FieldTerritoryMapProps } from './FieldTerritoryMap.types';
export type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGL2RenderingContext && canvas.getContext('webgl2')) || Boolean(canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function FieldTerritoryMap(props: FieldTerritoryMapProps) {
  const [compatibilityMode, setCompatibilityMode] = useState(false);

  useEffect(() => {
    const forced = sessionStorage.getItem('ns_map_engine') === 'leaflet';
    setCompatibilityMode(forced || !supportsWebGL());
  }, []);

  if (compatibilityMode) return <FieldTerritoryMapLegacy {...(props as any)} />;
  return <FieldTerritoryMapModern {...props} onEngineFailure={() => {
    sessionStorage.setItem('ns_map_engine', 'leaflet');
    setCompatibilityMode(true);
  }} />;
}

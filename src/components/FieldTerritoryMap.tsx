import FieldTerritoryMapLegacy from './FieldTerritoryMapLegacy';
import type { FieldTerritoryMapProps } from './FieldTerritoryMap.types';
export type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

export default function FieldTerritoryMap(props: FieldTerritoryMapProps) {
  const { className = '', ...rest } = props;
  return (
    <div className={`ns-map-shell ${className}`}>
      <FieldTerritoryMapLegacy {...rest} />
    </div>
  );
}

import FieldTerritoryMapModern from './FieldTerritoryMapModern';
import type { FieldTerritoryMapProps } from './FieldTerritoryMap.types';
export type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

export default function FieldTerritoryMap(props: FieldTerritoryMapProps) {
  return <FieldTerritoryMapModern {...props} />;
}

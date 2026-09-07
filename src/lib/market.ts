/** Home market for maps, hire packets, and demo data. */
export const MARKET = {
  city: 'Raleigh',
  state: 'NC',
  zip: '27616',
  county: 'Wake County',
  label: 'Raleigh, NC 27616',
  region: 'Raleigh, NC',
  phonePlaceholder: '919-000-0000',
  /** Northeast Raleigh / 27616 (Falls of Neuse · Wakefield). */
  lat: 35.8722,
  lng: -78.5378,
  zoom: 13,
} as const;

export const MARKET_CENTER: [number, number] = [MARKET.lat, MARKET.lng];

/** Default map pin only. Marketing copy is statewide North Carolina — never advertise a single ZIP. */
export const MARKET = {
  city: '',
  state: 'NC',
  zip: '',
  county: '',
  label: 'North Carolina',
  region: 'North Carolina',
  phonePlaceholder: '330-990-3956',
  /** Default map pin (Triangle). Not a service-area claim — we work all over NC. */
  lat: 35.8722,
  lng: -78.5378,
  zoom: 13,
} as const;

export const MARKET_CENTER: [number, number] = [MARKET.lat, MARKET.lng];

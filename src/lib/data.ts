import { DETAIL_PACKAGES, SPECIALTY_SERVICES } from './detailCatalog';

export {
  BOOKABLE_SERVICES,
  DETAIL_FAMILIES,
  DETAIL_FAMILY_COPY,
  DETAIL_PACKAGES,
  DETAIL_SELVES,
  DETAIL_SELF_COPY,
  SPECIALTY_SERVICES,
  checklistForService,
  findDetailPackage,
  minutesForService,
  packageForSelf,
  packagesForFamily,
  priceForService,
  serviceSelectGroups,
} from './detailCatalog';
export type { DetailFamily, DetailPackage, DetailSelf, DetailStep } from './detailCatalog';

const SERVICE_IMAGES: Record<string, { image: string; savingsMultiplier: number; category: string }> = {
  'Exterior Essential': { category: 'Exterior', savingsMultiplier: 2.5, image: 'https://images.pexels.com/photos/14231668/pexels-photo-14231668.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  'Exterior Signature': { category: 'Exterior', savingsMultiplier: 3, image: 'https://images.pexels.com/photos/14231668/pexels-photo-14231668.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  'Exterior Elite': { category: 'Exterior', savingsMultiplier: 4, image: 'https://images.pexels.com/photos/6870296/pexels-photo-6870296.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  'Interior Essential': { category: 'Interior', savingsMultiplier: 2, image: 'https://images.pexels.com/photos/6873185/pexels-photo-6873185.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  'Interior Signature': { category: 'Interior', savingsMultiplier: 2.5, image: 'https://images.pexels.com/photos/6873185/pexels-photo-6873185.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  'Interior Elite': { category: 'Interior', savingsMultiplier: 3.5, image: 'https://images.pexels.com/photos/6872599/pexels-photo-6872599.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  'Luxe Essential': { category: 'Detail', savingsMultiplier: 3, image: 'https://images.pexels.com/photos/6872599/pexels-photo-6872599.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  'Luxe Signature': { category: 'Detail', savingsMultiplier: 4, image: 'https://images.pexels.com/photos/6872599/pexels-photo-6872599.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  'Luxe Elite': { category: 'Detail', savingsMultiplier: 6, image: 'https://images.pexels.com/photos/7154635/pexels-photo-7154635.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  'Paint Correction': { category: 'Paint', savingsMultiplier: 8, image: 'https://images.pexels.com/photos/6870296/pexels-photo-6870296.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  'Luxe Ceramic Coating': { category: 'Ceramic', savingsMultiplier: 12, image: 'https://images.pexels.com/photos/7154635/pexels-photo-7154635.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
};

export const SERVICES = [...DETAIL_PACKAGES, ...SPECIALTY_SERVICES].map((pkg) => {
  const meta = SERVICE_IMAGES[pkg.name] || { category: 'Detail', savingsMultiplier: 3, image: SERVICE_IMAGES['Luxe Signature'].image };
  return {
    title: pkg.name,
    price: pkg.price,
    category: meta.category,
    desc: pkg.desc,
    items: pkg.features.slice(0, 6),
    image: meta.image,
    savingsMultiplier: meta.savingsMultiplier,
  };
});

/** All nine detail selves: Exterior, Interior, and Full vehicle × Essential / Signature / Elite. */
export const PACKAGES = DETAIL_PACKAGES;

export const MEMBERSHIPS = [
  {
    name: 'Luxe Monthly',
    price: 99,
    desc: 'Consistent upkeep for drivers who like their vehicle ready every month.',
    features: ['Monthly exterior wash', 'Wheel cleaning', 'Tire dressing', 'Interior maintenance', 'Glass cleaning'],
    savings: 'Protects up to $800/yr in minor paint degradation',
  },
  {
    name: 'Luxe Plus',
    price: 149,
    desc: 'A deeper maintenance rhythm with protection and priority scheduling.',
    features: ['Everything in Monthly', 'Interior deep clean every 3 months', 'Spray protection', 'Priority scheduling'],
    savings: 'Protects up to $1,500/yr in interior & exterior wear',
  },
  {
    name: 'Luxe VIP',
    price: 249,
    desc: 'Our highest-touch maintenance plan for vehicles that stay immaculate.',
    features: ['Monthly full maintenance detail', 'Interior protection', 'Exterior protection', 'Priority scheduling', 'Quarterly complimentary add-on'],
    savings: 'Protects up to $3,000/yr in total vehicle value',
  },
];

export const ADD_ONS: [string, number][] = [
  ['Pet Hair Removal', 75],
  ['Odor Treatment', 75],
  ['Engine Bay Detail', 100],
  ['Headlight Restoration', 100],
  ['Leather Conditioning', 75],
  ['Glass Coating', 125],
  ['Wheel Ceramic Coating', 250],
  ['Trim Restoration', 100],
  ['Carpet Extraction', 100],
  ['Ceramic Interior Protection', 200],
];

export const VEHICLE_SIZES = [
  { name: 'Sedan / Coupe', extra: 0 },
  { name: 'Small SUV / Crossover', extra: 25 },
  { name: 'Large SUV / Truck', extra: 50 },
  { name: 'Three-Row SUV / Large Truck', extra: 75 },
];

export const FAQS = [
  ['How long does a detail take?', 'Timing depends on the vehicle, package, and condition. A standard detail may take several hours, while correction and coating services can require a full day or more.'],
  ['Do you offer mobile detailing?', 'Yes. Concierge/mobile service can be requested when available. A mobile service fee may apply depending on location and service requirements.'],
  ['How much does detailing cost?', 'Our services start at the prices shown on the site. Final pricing can change based on vehicle size, condition, and selected add-ons.'],
  ['Do you work on luxury and exotic vehicles?', 'Yes. Our Luxe Collection is designed for premium, luxury, and specialty vehicles. Specialty vehicles receive a custom quote.'],
  ['Can you remove scratches?', 'Paint correction can improve many light-to-moderate paint imperfections. Deep scratches that have reached the underlying layers may require a different repair.'],
  ['How long does ceramic coating last?', 'Protection duration depends on the coating selected, preparation, maintenance, storage, and driving conditions. Ask about our 1-, 3-, and 5-year options.'],
  ['Do you require a deposit?', 'A deposit can be requested to reserve certain appointments. The exact requirement can be confirmed when your booking system is connected.'],
  ['What if my vehicle is extremely dirty?', 'No problem. We assess the vehicle before service. Excessive soil, heavy pet hair, biohazards, or unusually difficult conditions may require an additional charge.'],
];

export function money(value: number | null | undefined) {
  const safe=Number(value ?? 0);
  return `$${(Number.isFinite(safe)?safe:0).toLocaleString()}`;
}

export function prettyLabel(value?: string | null) {
  const text = String(value || '').trim();
  return text ? text.replaceAll('_', ' ') : '—';
}

export function firstWord(value?: string | null, fallback = '') {
  const word = String(value || '').trim().split(/\s+/)[0];
  return word || fallback;
}

export function isSettledPayment(status?: string | null) {
  const s = String(status || '').toLowerCase();
  return s === 'completed' || s === 'succeeded' || s === 'paid' || s === 'settled';
}

export function trendLabel(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return undefined;
  if (previous === 0) return current > 0 ? 'New' : undefined;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return 'Even';
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function calcSavings(lifetimeSpend: number): number {
  // Industry estimate: every $1 spent on detailing prevents ~$3-5 in long-term damage
  // Paint fading alone: $500-2000 in respray. Leather cracking: $1000-3000 replacement.
  // Resale value boost: well-maintained vehicles fetch 10-15% more at sale.
  return Math.round(lifetimeSpend * 3.8);
}


export const RECRUITING_STAGES = [
  ['applied', 'Applied'],
  ['review', 'Review'],
  ['first_interview_pending', '1st Round Interview Pending'],
  ['second_interview_pending', '2nd Round Interview Pending'],
  ['background_check', 'Pending Background Check'],
  ['job_offer_pending', 'Pending Job Offer'],
  ['offer_accepted', 'Offer Accepted'],
  ['scheduled_to_start', 'Scheduled to Start'],
  ['employed', 'Employed'],
  ['rejected', 'Rejected'],
  ['withdrawn', 'Withdrawn'],
  ['no_show', 'No Show'],
  ['archived', 'Archived'],
] as const;

export const DEFAULT_PAY_STRUCTURE = [
  { role: 'detailer', level: 1, label: 'Detailer - Level 1', payType: 'hourly', hourlyRate: 17, weeklyBase: 0, commissionRate: 0 },
  { role: 'detailer', level: 2, label: 'Detailer - Level 2', payType: 'hourly', hourlyRate: 18, weeklyBase: 0, commissionRate: 0 },
  { role: 'detailer', level: 3, label: 'Detailer - Level 3', payType: 'hourly', hourlyRate: 19, weeklyBase: 0, commissionRate: 0 },
  { role: 'manager', level: 1, label: 'Manager - Level 1', payType: 'hourly', hourlyRate: 22, weeklyBase: 0, commissionRate: 0 },
  { role: 'manager', level: 2, label: 'Manager - Level 2', payType: 'hourly', hourlyRate: 24, weeklyBase: 0, commissionRate: 0 },
  { role: 'manager', level: 3, label: 'Manager - Level 3', payType: 'hourly', hourlyRate: 26, weeklyBase: 0, commissionRate: 0 },
  { role: 'd2d_agent', level: 1, label: 'D2D Sales - Level 1', payType: 'base_commission', hourlyRate: 0, weeklyBase: 300, commissionRate: 10 },
  { role: 'd2d_agent', level: 2, label: 'D2D Sales - Level 2', payType: 'base_commission', hourlyRate: 0, weeklyBase: 350, commissionRate: 12.5 },
  { role: 'd2d_agent', level: 3, label: 'D2D Sales - Level 3', payType: 'base_commission', hourlyRate: 0, weeklyBase: 400, commissionRate: 15 },
] as const;

export type DetailFamily = 'exterior' | 'interior' | 'full';
export type DetailSelf = 'essential' | 'signature' | 'elite';

export type DetailStep = { label: string; required: boolean };

export type DetailPackage = {
  id: string;
  family: DetailFamily;
  self: DetailSelf;
  name: string;
  price: number;
  minutes: number;
  tag: string;
  desc: string;
  features: string[];
  checklist: DetailStep[];
  featured?: boolean;
};

export const DETAIL_FAMILIES: DetailFamily[] = ['exterior', 'interior', 'full'];
export const DETAIL_SELVES: DetailSelf[] = ['essential', 'signature', 'elite'];

export const DETAIL_FAMILY_COPY: Record<DetailFamily, { title: string; kicker: string; blurb: string }> = {
  exterior: {
    title: 'Exterior',
    kicker: 'Paint, wheels, glass',
    blurb: 'Three selves of the driveway wash — refresh, decontaminate, or protect.',
  },
  interior: {
    title: 'Interior',
    kicker: 'Cabin, leather, carpets',
    blurb: 'Three selves of the cabin reset — tidy, deep clean, or extract.',
  },
  full: {
    title: 'Full vehicle',
    kicker: 'Interior + exterior',
    blurb: 'Both processes in one visit, priced as a single package.',
  },
};

export const DETAIL_SELF_COPY: Record<DetailSelf, { title: string; tag: string }> = {
  essential: { title: 'Essential', tag: 'The refresh' },
  signature: { title: 'Signature', tag: 'Most popular' },
  elite: { title: 'Elite', tag: 'The full treatment' },
};

const EXTERIOR_STEPS: Record<DetailSelf, DetailStep[]> = {
  essential: [
    { label: 'Foam pre-wash', required: true },
    { label: 'Hand wash & dry', required: true },
    { label: 'Wheels & tires', required: true },
    { label: 'Exterior glass', required: true },
    { label: 'Spray sealant', required: true },
    { label: 'Tire dressing', required: false },
  ],
  signature: [
    { label: 'Foam pre-wash', required: true },
    { label: 'Hand wash & dry', required: true },
    { label: 'Wheels & tires', required: true },
    { label: 'Bug & tar removal', required: true },
    { label: 'Door jambs', required: true },
    { label: 'Clay / decontamination', required: true },
    { label: 'Exterior glass', required: true },
    { label: 'Trim wipe', required: true },
    { label: 'Spray sealant', required: true },
    { label: 'Tire dressing', required: true },
  ],
  elite: [
    { label: 'Foam pre-wash', required: true },
    { label: 'Hand wash & dry', required: true },
    { label: 'Wheels & tires', required: true },
    { label: 'Bug & tar removal', required: true },
    { label: 'Door jambs', required: true },
    { label: 'Clay / decontamination', required: true },
    { label: 'Paint enhancement pass', required: true },
    { label: 'Engine bay wipe', required: false },
    { label: 'Exterior glass', required: true },
    { label: 'Trim restoration', required: true },
    { label: 'Premium sealant', required: true },
    { label: 'Final panel inspection', required: true },
  ],
};

const INTERIOR_STEPS: Record<DetailSelf, DetailStep[]> = {
  essential: [
    { label: 'Full vacuum', required: true },
    { label: 'Dash & console wipe', required: true },
    { label: 'Interior glass', required: true },
    { label: 'Floor mats', required: true },
    { label: 'Surface dressing', required: false },
  ],
  signature: [
    { label: 'Full vacuum', required: true },
    { label: 'Dash & console', required: true },
    { label: 'Door panels', required: true },
    { label: 'Leather / vinyl clean', required: true },
    { label: 'Interior glass', required: true },
    { label: 'Floor mats & trunk', required: true },
    { label: 'UV protectant', required: true },
  ],
  elite: [
    { label: 'Full vacuum', required: true },
    { label: 'Dash, console & vents', required: true },
    { label: 'Door panels & jambs', required: true },
    { label: 'Leather treatment', required: true },
    { label: 'Carpet extraction', required: true },
    { label: 'Crevice detail', required: true },
    { label: 'Interior glass', required: true },
    { label: 'Odor / pet-hair pass', required: false },
    { label: 'UV / ceramic interior protectant', required: true },
  ],
};

function prefix(family: 'Exterior' | 'Interior', steps: DetailStep[]): DetailStep[] {
  return steps.map((step) => ({ ...step, label: `${family} · ${step.label}` }));
}

function composeChecklist(family: DetailFamily, self: DetailSelf): DetailStep[] {
  if (family === 'exterior') return EXTERIOR_STEPS[self];
  if (family === 'interior') return INTERIOR_STEPS[self];
  return [...prefix('Exterior', EXTERIOR_STEPS[self]), ...prefix('Interior', INTERIOR_STEPS[self])];
}

function composeFeatures(family: DetailFamily, self: DetailSelf): string[] {
  return composeChecklist(family, self).filter((step) => step.required).map((step) => step.label);
}

const PACKAGES_SRC: Array<Omit<DetailPackage, 'features' | 'checklist'>> = [
  { id: 'exterior-essential', family: 'exterior', self: 'essential', name: 'Exterior Essential', price: 125, minutes: 90, tag: 'The refresh', desc: 'Foam, hand wash, wheels, glass, and a spray sealant for a clean driveway finish.' },
  { id: 'exterior-signature', family: 'exterior', self: 'signature', name: 'Exterior Signature', price: 175, minutes: 120, tag: 'Most popular', desc: 'Adds decontamination, door jambs, and trim so the paint actually feels clean.', featured: true },
  { id: 'exterior-elite', family: 'exterior', self: 'elite', name: 'Exterior Elite', price: 275, minutes: 180, tag: 'The full treatment', desc: 'Paint enhancement, premium sealant, and a panel-by-panel inspection.' },
  { id: 'interior-essential', family: 'interior', self: 'essential', name: 'Interior Essential', price: 150, minutes: 90, tag: 'The refresh', desc: 'Vacuum, surfaces, glass, and mats — the cabin reset without a full extraction.' },
  { id: 'interior-signature', family: 'interior', self: 'signature', name: 'Interior Signature', price: 200, minutes: 135, tag: 'Most popular', desc: 'Leather, door panels, trunk, and UV protectant on top of the essential cabin work.', featured: true },
  { id: 'interior-elite', family: 'interior', self: 'elite', name: 'Interior Elite', price: 325, minutes: 180, tag: 'The full treatment', desc: 'Extraction, leather treatment, crevice work, and interior protection.' },
  { id: 'full-essential', family: 'full', self: 'essential', name: 'Luxe Essential', price: 175, minutes: 150, tag: 'The refresh', desc: 'Exterior Essential plus Interior Essential in one visit.' },
  { id: 'full-signature', family: 'full', self: 'signature', name: 'Luxe Signature', price: 275, minutes: 210, tag: 'Most popular', desc: 'Our balanced full-detail: Exterior Signature with Interior Signature.', featured: true },
  { id: 'full-elite', family: 'full', self: 'elite', name: 'Luxe Elite', price: 450, minutes: 300, tag: 'The full treatment', desc: 'Both Elite selves — paint enhancement and a deep interior extraction.' },
];

export const DETAIL_PACKAGES: DetailPackage[] = PACKAGES_SRC.map((pkg) => ({
  ...pkg,
  features: composeFeatures(pkg.family, pkg.self),
  checklist: composeChecklist(pkg.family, pkg.self),
}));

export const SPECIALTY_SERVICES: DetailPackage[] = [
  {
    id: 'paint-correction',
    family: 'exterior',
    self: 'elite',
    name: 'Paint Correction',
    price: 350,
    minutes: 240,
    tag: 'Paint',
    desc: 'Machine polishing to improve swirls, oxidation, and light imperfections.',
    features: ['Paint inspection', 'Decontamination', 'Machine polishing', 'Gloss enhancement', 'Panel-by-panel finish'],
    checklist: [
      { label: 'Paint inspection', required: true },
      { label: 'Decontamination', required: true },
      { label: 'Machine polishing', required: true },
      { label: 'Gloss enhancement', required: true },
      { label: 'Panel-by-panel finish', required: true },
    ],
  },
  {
    id: 'ceramic-coating',
    family: 'exterior',
    self: 'elite',
    name: 'Luxe Ceramic Coating',
    price: 650,
    minutes: 480,
    tag: 'Ceramic',
    desc: 'Paint prep plus hydrophobic coating with a cure inspection.',
    features: ['Paint preparation', 'Chemical decontamination', 'Clay treatment', 'Coating application', 'Cure inspection'],
    checklist: [
      { label: 'Paint preparation', required: true },
      { label: 'Chemical decontamination', required: true },
      { label: 'Clay treatment', required: true },
      { label: 'Coating application', required: true },
      { label: 'Cure inspection', required: true },
    ],
  },
];

export const BOOKABLE_SERVICES: DetailPackage[] = [...DETAIL_PACKAGES, ...SPECIALTY_SERVICES];

const NAME_ALIASES: Record<string, string> = {
  'luxe exterior detail': 'exterior-signature',
  'exterior detail': 'exterior-signature',
  'luxe interior detail': 'interior-signature',
  'interior detail': 'interior-signature',
  'luxe signature detail': 'full-signature',
  'signature detail': 'full-signature',
  'luxe essential': 'full-essential',
  'luxe signature': 'full-signature',
  'luxe elite': 'full-elite',
};

function keyOf(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export function findDetailPackage(name?: string | null): DetailPackage | undefined {
  const key = keyOf(name);
  if (!key) return undefined;
  const aliased = NAME_ALIASES[key];
  return BOOKABLE_SERVICES.find((pkg) => pkg.id === aliased || keyOf(pkg.name) === key);
}

export function packagesForFamily(family: DetailFamily): DetailPackage[] {
  return DETAIL_PACKAGES.filter((pkg) => pkg.family === family);
}

export function packageForSelf(family: DetailFamily, self: DetailSelf): DetailPackage {
  return packagesForFamily(family).find((pkg) => pkg.self === self) || packagesForFamily(family)[1] || DETAIL_PACKAGES[4];
}

export function checklistForService(...names: Array<string | null | undefined>): DetailStep[] {
  for (const name of names) {
    const found = findDetailPackage(name);
    if (found?.checklist.length) return found.checklist;
  }
  return [];
}

export function minutesForService(name?: string | null, fallback = 120) {
  return findDetailPackage(name)?.minutes || fallback;
}

export function priceForService(name?: string | null, fallback = 275) {
  return findDetailPackage(name)?.price || fallback;
}

export function serviceSelectGroups() {
  return [
    { label: 'Exterior details', items: packagesForFamily('exterior') },
    { label: 'Interior details', items: packagesForFamily('interior') },
    { label: 'Full vehicle', items: packagesForFamily('full') },
    { label: 'Specialty', items: SPECIALTY_SERVICES },
  ];
}

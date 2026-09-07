import { isDemoMode, supabase } from './supabase';
import {
  composePersonName,
  composeStreetAddress,
  splitPersonName,
  splitStreetAddress,
  type SrLeadFields,
} from './salesRabbitLeads';

export type PresentationHousehold = {
  first_name: string;
  last_name: string;
  phone: string;
  alt_phone: string;
  email: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postal_code: string;
  vehicle: string;
  name: string;
  address: string;
};

export type OfferSelection = {
  type: 'service' | 'membership';
  name: string;
  amount: number;
  detail: string;
  household: PresentationHousehold;
  createPortalAccount: boolean;
  portalPassword: string;
  sendInviteEmail: boolean;
};

export type DoorCustomerAccount = {
  user_id: string;
  email: string;
  created: boolean;
  existing: boolean;
  emailed: boolean;
  password?: string;
  login_url: string;
};

export type ApplyOfferResult = {
  saved: boolean;
  account?: DoorCustomerAccount;
  error?: string;
};

export const emptyPresentationHousehold = (): PresentationHousehold => ({
  first_name: '',
  last_name: '',
  phone: '',
  alt_phone: '',
  email: '',
  street1: '',
  street2: '',
  city: '',
  state: 'NC',
  postal_code: '',
  vehicle: '',
  name: '',
  address: '',
});

export function householdFromSeed(seed: Partial<PresentationHousehold> & {
  customer_name?: string;
  name?: string;
  address?: string;
  vehicle_info?: string;
} = {}): PresentationHousehold {
  const names = splitPersonName(seed.first_name || seed.last_name ? `${seed.first_name || ''} ${seed.last_name || ''}` : (seed.customer_name || seed.name || ''));
  const street = splitStreetAddress(seed.address);
  const first = seed.first_name?.trim() || names.first_name;
  const last = seed.last_name?.trim() || names.last_name;
  const street1 = seed.street1?.trim() || street.street1;
  const street2 = seed.street2?.trim() || street.street2;
  const city = seed.city?.trim() || street.city;
  const state = seed.state?.trim() || street.state || 'NC';
  const postal = seed.postal_code?.trim() || street.postal_code;
  const next: PresentationHousehold = {
    ...emptyPresentationHousehold(),
    first_name: first,
    last_name: last,
    phone: seed.phone?.trim() || '',
    alt_phone: seed.alt_phone?.trim() || '',
    email: seed.email?.trim() || '',
    street1,
    street2,
    city,
    state,
    postal_code: postal,
    vehicle: seed.vehicle?.trim() || seed.vehicle_info?.trim() || '',
    name: '',
    address: '',
  };
  next.name = composePersonName(next.first_name, next.last_name, seed.name || seed.customer_name || '');
  next.address = composeStreetAddress(next, seed.address || '');
  return next;
}

export function patchHousehold(prev: PresentationHousehold, patch: Partial<PresentationHousehold>): PresentationHousehold {
  const next = { ...prev, ...patch };
  if (patch.first_name !== undefined || patch.last_name !== undefined) {
    next.name = composePersonName(next.first_name, next.last_name, next.name);
  } else if (patch.name !== undefined) {
    const names = splitPersonName(patch.name);
    next.first_name = names.first_name;
    next.last_name = names.last_name;
    next.name = composePersonName(next.first_name, next.last_name, patch.name);
  }
  if (
    patch.street1 !== undefined ||
    patch.street2 !== undefined ||
    patch.city !== undefined ||
    patch.state !== undefined ||
    patch.postal_code !== undefined
  ) {
    next.address = composeStreetAddress(next, next.address);
  } else if (patch.address !== undefined) {
    const street = splitStreetAddress(patch.address);
    next.street1 = street.street1 || next.street1;
    next.street2 = street.street2 || next.street2;
    next.city = street.city || next.city;
    next.state = street.state || next.state;
    next.postal_code = street.postal_code || next.postal_code;
    next.address = composeStreetAddress(next, patch.address);
  }
  return next;
}

export function householdAsLeadFields(hh: PresentationHousehold): SrLeadFields {
  return {
    first_name: hh.first_name,
    last_name: hh.last_name,
    phone: hh.phone,
    alt_phone: hh.alt_phone,
    email: hh.email,
    street1: hh.street1,
    street2: hh.street2,
    city: hh.city,
    state: hh.state,
    postal_code: hh.postal_code,
    notes: '',
    vehicle: hh.vehicle,
    service: '',
    value: '',
    follow_up_at: '',
    appointment_at: '',
  };
}

export function generateDoorPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let body = '';
  for (const b of bytes) body += alphabet[b % alphabet.length];
  return `Ns-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function portalLoginUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) return `${window.location.origin}/login`;
  return 'https://ns-auto-luxe-os.vercel.app/login';
}

export async function createDoorCustomerAccount(input: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  vehicle_info?: string;
  address?: string;
  lead_id?: string | null;
  send_email?: boolean;
  membership?: { name: string; price: number } | null;
}): Promise<DoorCustomerAccount> {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const login_url = portalLoginUrl();
  if (!email || !email.includes('@')) throw new Error('A valid email is required to create their portal login.');
  if (password.length < 8) throw new Error('Portal password must be at least 8 characters.');

  if (isDemoMode) {
    return {
      user_id: `demo_${crypto.randomUUID()}`,
      email,
      created: true,
      existing: false,
      emailed: false,
      password,
      login_url,
    };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ns-auto-luxe-os.vercel.app';
  const { data, error } = await supabase.functions.invoke('create-customer-account', {
    body: {
      email,
      password,
      full_name: input.full_name,
      phone: input.phone || '',
      vehicle_info: input.vehicle_info || '',
      address: input.address || '',
      lead_id: input.lead_id || null,
      send_email: Boolean(input.send_email),
      membership: input.membership || null,
      redirect_to: `${origin}/login`,
    },
  });
  const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  if (error || payload.error) {
    throw new Error(String(payload.error || error?.message || 'Unable to create the customer account.'));
  }
  return {
    user_id: String(payload.user_id || ''),
    email: String(payload.email || email),
    created: Boolean(payload.created),
    existing: Boolean(payload.existing),
    emailed: Boolean(payload.emailed),
    password: payload.created ? password : password,
    login_url,
  };
}
